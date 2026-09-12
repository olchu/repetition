"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MoreHorizontal, Play, RotateCcw } from "lucide-react";
import { useStartAttempt } from "@/lib/use-start-attempt";
import styles from "./TestActionsMenu.module.css";

type TestActionsMenuProps = {
  testId: string;
  /** How many attempts the child has made — gates "Start again" wording and history. */
  attemptCount: number;
  /** Set when there is a resumable attempt to jump straight into. */
  inProgressAttemptId?: string | null;
};

export function TestActionsMenu({ testId, attemptCount, inProgressAttemptId }: TestActionsMenuProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { start, busy, error } = useStartAttempt(testId);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hasHistory = attemptCount > 0;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Test actions"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {inProgressAttemptId ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => router.push(`/dashboard/attempts/${inProgressAttemptId}`)}
            >
              <Play size={15} strokeWidth={2.2} aria-hidden="true" />
              Continue test
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={busy}
              onClick={() => void start()}
            >
              {hasHistory
                ? <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
                : <Play size={15} strokeWidth={2.2} aria-hidden="true" />}
              {busy ? "Starting…" : hasHistory ? "Start again" : "Start test"}
            </button>
          )}

          {hasHistory && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => router.push(`/dashboard/tests/${testId}/history`)}
            >
              <History size={15} strokeWidth={2.2} aria-hidden="true" />
              View history
            </button>
          )}

          {error && <p className={styles.error} role="status">{error}</p>}
        </div>
      )}
    </div>
  );
}
