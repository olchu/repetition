"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../../../page.module.css";

type History = {
  test: { id: string; title: string; subject: string };
  attempts: Array<{ id: string; submittedAt: string; earnedPoints: number; totalPoints: number; percentage: number; passed: boolean }>;
};

type RouteContext = { params: Promise<{ testId: string }> };

export default function HistoryPage({ params }: RouteContext) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState(false);

  const loadHistory = useCallback(async () => {
    const { testId } = await params;
    const response = await fetch(`/api/v1/me/tests/${testId}/results`, { cache: "no-store" });
    if (!response.ok) {
      setError(true);
      return;
    }
    setHistory((await response.json()) as History);
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  if (error) return <main className={styles.statePage}><div className={styles.stateCard}><h1>History is unavailable.</h1><Link className={styles.primaryAction} href="/dashboard">Back to progress</Link></div></main>;
  if (!history) return <main className={styles.statePage}>Loading test history…</main>;

  const best = history.attempts.reduce((score, attempt) => Math.max(score, attempt.percentage), 0);
  return <main className={styles.detailPage}><Link className={styles.backLink} href={`/dashboard/tests/${history.test.id}`}>← Back to test</Link><p className={styles.eyebrow}>{history.test.subject}</p><h1>{history.test.title}</h1><p className={styles.detailCopy}>Your previous attempts. Best score: {best}%.</p><div className={styles.historyList}>{history.attempts.length === 0 ? <p>No completed attempts yet.</p> : history.attempts.map((attempt, index) => <article key={attempt.id}><span>Attempt {history.attempts.length - index}</span><strong>{attempt.percentage}%</strong><p>{attempt.earnedPoints} / {attempt.totalPoints} points · {new Date(attempt.submittedAt).toLocaleDateString()}</p><em className={attempt.passed ? styles.answerGood : styles.answerWrong}>{attempt.passed ? "Passed" : "Keep practicing"}</em></article>)}</div></main>;
}
