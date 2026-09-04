"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../../page.module.css";

type Question = {
  id: string;
  text: string;
  points: number;
  options: Array<{ id: string; text: string }>;
  correctOptionId?: string | null;
  explanation?: string | null;
};

type Attempt = {
  id: string;
  status: "in_progress" | "submitted";
  test: { id: string; title: string; questions: Question[] };
  answers: Array<{ questionId: string; optionId: string }>;
  result: { earnedPoints: number; totalPoints: number; percentage: number; passed: boolean } | null;
};

type RouteContext = { params: Promise<{ attemptId: string }> };

export default function AttemptPage({ params }: RouteContext) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error" | "saving" | "submitting">("loading");
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const loadAttempt = useCallback(async () => {
    const { attemptId: resolvedAttemptId } = await params;
    setAttemptId(resolvedAttemptId);
    try {
      const response = await fetch(`/api/v1/me/attempts/${resolvedAttemptId}`, { cache: "no-store" });
      if (!response.ok) {
        setState("error");
        return;
      }
      const payload = (await response.json()) as { attempt: Attempt };
      setAttempt(payload.attempt);
      setAnswers(Object.fromEntries(payload.attempt.answers.map((answer) => [answer.questionId, answer.optionId])));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAttempt(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAttempt]);

  async function chooseOption(questionId: string, optionId: string) {
    if (!attemptId || !attempt || attempt.status !== "in_progress") return;
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
    setState("saving");
    const response = await fetch(`/api/v1/me/attempts/${attemptId}/answers/${questionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    setState(response.ok ? "ready" : "error");
  }

  async function submitAttempt() {
    if (!attemptId || attempt?.status !== "in_progress") return;
    if (!window.confirm("Submit this attempt? You will not be able to change your answers.")) return;
    setState("submitting");
    const response = await fetch(`/api/v1/me/attempts/${attemptId}/submit`, { method: "POST" });
    if (!response.ok) {
      setState("error");
      return;
    }
    const payload = (await response.json()) as { attempt: Attempt };
    setAttempt(payload.attempt);
    setState("ready");
  }

  if (state === "loading") return <main className={styles.statePage}>Loading your attempt…</main>;
  if (state === "error" || !attempt) return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>We couldn&apos;t open this attempt.</h1><p>Go back to your progress and try the test again.</p><Link className={styles.primaryAction} href="/dashboard">Back to progress</Link></div></main>;

  if (attempt.status === "submitted" && attempt.result) {
    return (
      <main className={styles.attemptPage}>
        <Link className={styles.backLink} href="/dashboard">← Back to progress</Link>
        <p className={styles.eyebrow}>Attempt complete</p>
        <h1>{attempt.result.passed ? "You passed." : "Keep practicing."}</h1>
        <div className={styles.resultScore}><strong>{attempt.result.percentage}%</strong><span>{attempt.result.earnedPoints} of {attempt.result.totalPoints} points</span></div>
        <p className={styles.resultMessage}>{attempt.result.passed ? "That work is now part of your progress." : "Review the answers below, then try again when you are ready."}</p>
        <div className={styles.reviewList}>
          {attempt.test.questions.map((question, index) => {
            const selected = question.options.find((option) => option.id === answers[question.id]);
            const correct = question.options.find((option) => option.id === question.correctOptionId);
            return <article className={styles.reviewItem} key={question.id}><span>0{index + 1}</span><div><h2>{question.text}</h2><p className={selected?.id === correct?.id ? styles.answerGood : styles.answerWrong}>Your answer: {selected?.text ?? "Not answered"}</p><p>Correct answer: {correct?.text ?? "—"}</p>{question.explanation && <p className={styles.explanation}>{question.explanation}</p>}</div></article>;
          })}
        </div>
        <Link className={styles.primaryAction} href={`/dashboard/tests/${attempt.test.id}`}>Start another attempt <span aria-hidden="true">↗</span></Link>
      </main>
    );
  }

  const question = attempt.test.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className={styles.attemptPage}>
      <header className={styles.attemptHeader}><Link className={styles.backLink} href="/dashboard">← Exit test</Link><span>{answeredCount} / {attempt.test.questions.length} answered</span></header>
      <div className={styles.attemptProgress}><span style={{ width: `${((currentIndex + 1) / attempt.test.questions.length) * 100}%` }} /></div>
      <p className={styles.questionNumber}>Question {currentIndex + 1} of {attempt.test.questions.length}</p>
      <section className={styles.question} aria-labelledby="question-title"><h1 id="question-title">{question.text}</h1><p>{question.points} {question.points === 1 ? "point" : "points"}</p><div className={styles.options} role="radiogroup" aria-label="Answer choices">{question.options.map((option) => <button className={`${styles.option} ${answers[question.id] === option.id ? styles.optionSelected : ""}`} key={option.id} type="button" role="radio" aria-checked={answers[question.id] === option.id} onClick={() => void chooseOption(question.id, option.id)}>{option.text}<span aria-hidden="true">{answers[question.id] === option.id ? "✓" : ""}</span></button>)}</div></section>
      <footer className={styles.attemptActions}><button type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>Previous</button>{currentIndex < attempt.test.questions.length - 1 ? <button className={styles.primaryAction} type="button" onClick={() => setCurrentIndex((index) => index + 1)}>Next <span aria-hidden="true">→</span></button> : <button className={styles.primaryAction} type="button" onClick={() => void submitAttempt()} disabled={state === "submitting" || state === "saving"}>{state === "submitting" ? "Submitting…" : "Submit attempt"}<span aria-hidden="true">↗</span></button>}</footer>
    </main>
  );
}
