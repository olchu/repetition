"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronsRight, Lightbulb, X } from "lucide-react";
import styles from "../../test.module.css";

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
  test: { id: string; title: string; subject: string; questions: Question[] };
  answers: Array<{ questionId: string; optionId: string }>;
  result: { earnedPoints: number; totalPoints: number; percentage: number; passed: boolean } | null;
};

type RouteContext = { params: Promise<{ attemptId: string }> };

export default function AttemptPage({ params }: RouteContext) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error" | "saving" | "submitting">("loading");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      setDrafts(Object.fromEntries(payload.attempt.answers.map((answer) => [answer.questionId, answer.optionId])));
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
    if (!attemptId || !attempt || attempt.status !== "in_progress" || state !== "ready") return;
    setSaveError(null);
    setState("saving");
    try {
      const response = await fetch(`/api/v1/me/attempts/${attemptId}/answers/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!response.ok) throw new Error("Answer could not be saved");
      const payload = (await response.json()) as { feedback: { correctOptionId: string | null; explanation: string | null } };
      setAnswers((current) => ({ ...current, [questionId]: optionId }));
      setAttempt((current) => current ? {
        ...current,
        test: { ...current.test, questions: current.test.questions.map((item) => item.id === questionId ? { ...item, ...payload.feedback } : item) },
      } : current);
    } catch {
      setSaveError("Your answer wasn’t saved. Please try again.");
    } finally {
      setState("ready");
    }
  }

  async function submitAttempt() {
    if (!attemptId || attempt?.status !== "in_progress") return;
    setSaveError(null);
    setState("submitting");
    try {
      const response = await fetch(`/api/v1/me/attempts/${attemptId}/submit`, { method: "POST" });
      if (!response.ok) throw new Error("Attempt could not be submitted");
      const payload = (await response.json()) as { attempt: Attempt };
      setAttempt(payload.attempt);
    } catch {
      setSaveError("Your test couldn’t be submitted. Please try again.");
    } finally {
      setState("ready");
    }
  }

  if (state === "loading") return <main className={styles.statePage}>Loading your attempt…</main>;
  if (state === "error" || !attempt) return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>We couldn&apos;t open this attempt.</h1><p>Go back to your progress and try the test again.</p><Link className={styles.primaryAction} href="/dashboard">Back to progress</Link></div></main>;

  const question = attempt.test.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const busy = state === "saving" || state === "submitting";
  const isLastQuestion = currentIndex === attempt.test.questions.length - 1;

  if (!question) return <main className={styles.statePage}>This test has no questions yet.</main>;
  const submitted = attempt.status === "submitted";
  const checked = Boolean(answers[question.id]) || submitted;
  const correct = checked && answers[question.id] === question.correctOptionId;
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);

  return (
    <main className={styles.attemptPage}>
      <Link className={styles.backLink} href="/dashboard"><ArrowLeft size={14} aria-hidden="true" />Exit test</Link>
      <header>
        <p className={styles.eyebrow}>{attempt.test.subject} test</p>
        <h1 className={styles.title}>{attempt.test.title}</h1>
      </header>
      <div className={styles.progressRow}>
        <p className={styles.progressLabel}>Question {currentIndex + 1} of {attempt.test.questions.length}</p>
        <div className={styles.segments} role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={attempt.test.questions.length} aria-valuenow={answeredCount}>
          {attempt.test.questions.map((item, index) => (
            <span key={item.id} className={`${styles.segment} ${answers[item.id] ? styles.segmentAnswered : ""} ${index === currentIndex ? styles.segmentCurrent : ""}`} />
          ))}
        </div>
      </div>
      <section className={styles.question} aria-labelledby="question-title">
        <p className={styles.questionNumber}>Question {currentIndex + 1}</p>
        <h2 id="question-title">{question.text}</h2>
        <div className={styles.options} role="group" aria-label="Answer choices">
          {question.options.map((option, index) => (
            <button className={`${styles.option} ${drafts[question.id] === option.id ? styles.optionSelected : ""} ${checked && option.id === question.correctOptionId ? styles.optionCorrect : ""} ${checked && answers[question.id] === option.id && !correct ? styles.optionWrong : ""}`} key={option.id} type="button" aria-pressed={drafts[question.id] === option.id} disabled={busy || checked} onClick={() => { setDrafts((current) => ({ ...current, [question.id]: option.id })); setSaveError(null); }}>
              <span className={styles.optionLetter} aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <span className={styles.optionText}>{option.text}</span>
            </button>
          ))}
        </div>
        {checked && <div className={`${styles.feedback} ${correct ? styles.feedbackCorrect : styles.feedbackWrong}`} role="status">
          <div className={styles.feedbackHeading}>
            {correct ? <Check size={24} aria-hidden="true" /> : <X size={24} aria-hidden="true" />}
            <div><h3>{correct ? "Correct!" : answers[question.id] ? "Not quite!" : "Not answered"}</h3><p>{correct ? "Well done! You got it right." : `The correct answer is ${correctOption?.text ?? "unavailable"}.`}</p></div>
          </div>
          {question.explanation && <div className={styles.feedbackExplanation}><Lightbulb size={20} aria-hidden="true" /><div><h4>Explanation</h4><p>{question.explanation}</p></div></div>}
        </div>}
        {(saveError || state === "saving") && <p className={styles.saveStatus} role="status">{saveError ?? "Checking your answer…"}</p>}
        {submitted && attempt.result && <div className={styles.completion} role="status"><strong>{attempt.result.passed ? "Test passed!" : "Test complete — keep practicing!"}</strong><p>{attempt.result.percentage}% · {attempt.result.earnedPoints} of {attempt.result.totalPoints} points</p></div>}
        <footer className={styles.attemptActions}>
          <div className={styles.secondaryActions}>
            {currentIndex > 0 && <button className={styles.secondaryAction} type="button" onClick={() => setCurrentIndex((index) => index - 1)} disabled={busy}><ArrowLeft size={17} aria-hidden="true" />Previous</button>}
            {!isLastQuestion && !checked && <button className={styles.secondaryAction} type="button" onClick={() => { setCurrentIndex((index) => index + 1); setSaveError(null); }} disabled={busy}><ChevronsRight size={19} aria-hidden="true" />Skip question</button>}
          </div>
          {!checked ? (
            <button className={styles.primaryAction} type="button" onClick={() => void chooseOption(question.id, drafts[question.id])} disabled={busy || !drafts[question.id]}>{state === "saving" ? "Checking…" : "Check answer"}<Check size={20} aria-hidden="true" /></button>
          ) : isLastQuestion && submitted ? (
            <Link className={styles.primaryAction} href="/dashboard">Back to dashboard<ArrowRight size={20} aria-hidden="true" /></Link>
          ) : isLastQuestion ? (
            <button className={styles.primaryAction} type="button" onClick={() => void submitAttempt()} disabled={busy}>{state === "submitting" ? "Submitting…" : "Submit test"}<ArrowRight size={20} aria-hidden="true" /></button>
          ) : (
            <button className={styles.primaryAction} type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={busy}>Next question<ArrowRight size={20} aria-hidden="true" /></button>
          )}
        </footer>
      </section>
    </main>
  );
}
