"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { StudentTest } from "@/lib/student-progress";
import { useStartAttempt } from "@/lib/use-start-attempt";
import styles from "./TestActionButton.module.css";

/** An unfinished attempt always wins, even on a test that is already passed:
 *  the child is mid-retry and the way on is to continue it. */
export function TestActionButton({ test }: { test: StudentTest }) {
  const router = useRouter();
  const { start, busy, error } = useStartAttempt(test.id);
  const label = test.inProgressAttemptId ? "Continue" : test.completed ? "Try again" : "Start";

  return (
    <>
      <button
        className={styles.action}
        type="button"
        disabled={busy}
        onClick={() =>
          test.inProgressAttemptId
            ? router.push(`/dashboard/attempts/${test.inProgressAttemptId}`)
            : void start()
        }
      >
        {busy ? "Starting…" : label}
        <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {error && <p className={styles.error} role="status">{error}</p>}
    </>
  );
}
