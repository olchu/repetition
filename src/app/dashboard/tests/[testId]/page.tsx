"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "../../page.module.css";

type Test = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: string | null;
  passPercentage: number;
  questionCount: number;
  questions: Array<{ id: string; text: string; options: Array<{ id: string; text: string }> }>;
};

type RouteContext = { params: Promise<{ testId: string }> };

export default function TestStartPage({ params }: RouteContext) {
  const [test, setTest] = useState<Test | null>(null);
  const [state, setState] = useState<"loading" | "error" | "starting">("loading");
  const [testId, setTestId] = useState<string | null>(null);

  const router = useRouter();
  const loadTest = useCallback(async () => {
    const { testId: resolvedTestId } = await params;
    setTestId(resolvedTestId);
    try {
      const response = await fetch(`/api/v1/me/tests/${resolvedTestId}`, { cache: "no-store" });
      if (!response.ok) {
        setState("error");
        return;
      }
      const payload = (await response.json()) as { test: Test };
      setTest(payload.test);
      setState("loading");
    } catch {
      setState("error");
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTest(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTest]);

  async function startAttempt() {
    if (!testId) return;
    setState("starting");
    const response = await fetch(`/api/v1/me/tests/${testId}/attempts`, { method: "POST" });
    if (!response.ok) {
      setState("error");
      return;
    }
    const payload = (await response.json()) as { attempt: { id: string } };
    router.push(`/dashboard/attempts/${payload.attempt.id}`);
  }

  if (state === "loading" && !test) return <main className={styles.statePage}>Loading test…</main>;
  if (state === "error" || !test) return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>This test isn&apos;t available.</h1><p>It may no longer be assigned to you.</p><Link className={styles.primaryAction} href="/dashboard">Back to progress</Link></div></main>;

  return (
    <main className={styles.detailPage}>
      <Link className={styles.backLink} href="/dashboard">← Back to progress</Link>
      <p className={styles.eyebrow}>{test.subject} · {test.grade ? `Grade ${test.grade}` : "Practice"}</p>
      <h1>{test.title}</h1>
      <p className={styles.detailCopy}>{test.description ?? "A focused practice set to help you keep moving."}</p>
      <div className={styles.detailMeta}><span>{test.questionCount} questions</span><span>Pass at {test.passPercentage}%</span><span>No time limit</span></div>
      <div className={styles.detailActions}><button className={styles.primaryAction} type="button" onClick={() => void startAttempt()} disabled={state === "starting"}>{state === "starting" ? "Starting…" : "Start test"}<span aria-hidden="true">↗</span></button><Link className={styles.secondaryAction} href={`/dashboard/tests/${test.id}/history`}>View history</Link></div>
    </main>
  );
}
