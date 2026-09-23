"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { StudentOverview } from "./student-progress";

export type OverviewError = "unauthorized" | "unavailable";

type StudentOverviewContextValue = ReturnType<typeof useStudentOverviewState>;

const StudentOverviewContext = createContext<StudentOverviewContextValue | null>(null);

/** One loader shared by the whole learning room, so navigation neither
 *  refetches the same summary nor temporarily removes the persistent frame. */
function useStudentOverviewState() {
  const [data, setData] = useState<StudentOverview | null>(null);
  const [error, setError] = useState<OverviewError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/me/dashboard", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setError("unauthorized");
        return;
      }
      if (!response.ok) {
        setError("unavailable");
        return;
      }
      setData((await response.json()) as StudentOverview);
    } catch {
      setError("unavailable");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { data, error, isLoading, reload };
}

export function StudentOverviewProvider({ children }: { children: ReactNode }) {
  const value = useStudentOverviewState();
  return createElement(StudentOverviewContext.Provider, { value }, children);
}

export function useStudentOverview() {
  const context = useContext(StudentOverviewContext);
  if (!context) throw new Error("StudentOverviewProvider is required.");
  return context;
}
