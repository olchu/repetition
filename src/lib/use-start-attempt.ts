"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/** Starts a test, or resumes the unfinished attempt the server finds for it.
 *  The server decides which — concurrent starts resolve to one attempt. */
export function useStartAttempt(testId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/me/tests/${testId}/attempts`, { method: "POST" });
      if (!response.ok) throw new Error("start failed");
      const payload = (await response.json()) as { attempt: { id: string } };
      router.push(`/dashboard/attempts/${payload.attempt.id}`);
    } catch {
      setError("Couldn’t start the test. Try again.");
      setBusy(false);
    }
  }, [busy, router, testId]);

  return { start, busy, error };
}
