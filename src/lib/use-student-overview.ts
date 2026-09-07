"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentOverview } from "./student-progress";

export type OverviewError = "unauthorized" | "unavailable";

/** One loader for every learning-room section, so the sections can't drift
 *  apart on the numbers they show. */
export function useStudentOverview() {
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
