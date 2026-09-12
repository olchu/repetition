import { NextResponse } from "next/server";
import { reviewAttemptQuestions, type AdminAttempt } from "./attempt-review";
import type { StoredQuestion } from "./test-content";

/** Bump when a report shape changes; the formats are described in docs/RESULT-REPORT.md. */
const REPORT_VERSION = "1.0";

type Review = ReturnType<typeof reviewAttemptQuestions>[number];
type Outcome = "correct" | "incorrect" | "unanswered";
type Trend = "mastered" | "improved" | "regressed" | "struggling";

/** A question in the test upload format, so a report can seed a follow-up test. */
function uploadFormat(question: StoredQuestion) {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    ...(question.type === "choice"
      ? { options: question.options, correctOptionId: question.correctOptionId }
      : { correctAnswers: question.correctAnswers }),
    // Absent rather than null, as in an uploaded test file.
    ...(question.hint ? { hint: question.hint } : {}),
    ...(question.explanation ? { explanation: question.explanation } : {}),
  };
}

function outcomeOf({ answer, isCorrect }: Review): Outcome {
  return !answer ? "unanswered" : isCorrect ? "correct" : "incorrect";
}

/** The chosen option with its text, or the value exactly as the child typed it. */
function childAnswer({ question, answer }: Review) {
  if (!answer) return null;
  return question.type === "choice"
    ? { optionId: answer.optionId, text: question.options.find((option) => option.id === answer.optionId)?.text ?? null }
    : { value: answer.value };
}

/** Correct without opening the hint: the only outcome that needs no more practice. */
function isClean(entry: { outcome: Outcome; hintUsed: boolean }) {
  return entry.outcome === "correct" && !entry.hintUsed;
}

/**
 * mastered: clean every time; improved: clean in the latest attempt after
 * earlier trouble; regressed: clean before but not in the latest attempt;
 * struggling: never clean.
 */
function trendOf(timeline: ReadonlyArray<{ outcome: Outcome; hintUsed: boolean }>): Trend {
  if (timeline.every(isClean)) return "mastered";
  if (isClean(timeline[timeline.length - 1])) return "improved";
  return timeline.some(isClean) ? "regressed" : "struggling";
}

function childOf(attempt: AdminAttempt) {
  return {
    displayName: attempt.child.childProfile?.displayName ?? attempt.child.login,
    login: attempt.child.login,
    grade: attempt.child.childProfile?.grade ?? null,
  };
}

function resultOf(attempt: AdminAttempt) {
  return attempt.result
    ? {
        earnedPoints: attempt.result.earnedPoints,
        totalPoints: attempt.result.totalPoints,
        percentage: attempt.result.percentage,
        passed: attempt.result.passed,
      }
    : null;
}

/** One attempt: where the child went wrong, skipped or needed a hint. */
export function buildAttemptReport(attempt: AdminAttempt) {
  const test = attempt.assignment.test;
  const questions = reviewAttemptQuestions(attempt).map((review) => ({
    ...uploadFormat(review.question),
    childResult: {
      outcome: outcomeOf(review),
      hintUsed: review.hintUsed,
      answer: childAnswer(review),
      earnedPoints: review.earnedPoints,
    },
  }));
  const results = questions.map((question) => question.childResult);
  const count = (outcome: Outcome) => results.filter((result) => result.outcome === outcome).length;

  return {
    reportVersion: REPORT_VERSION,
    scope: "attempt",
    exportedAt: new Date().toISOString(),
    child: childOf(attempt),
    test: {
      stableId: test.stableId,
      version: test.version,
      title: test.title,
      subject: test.subject.slug,
      grade: test.grade,
      passPercentage: test.passPercentage,
    },
    attempt: {
      id: attempt.id,
      status: attempt.status.toLowerCase(),
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    },
    result: resultOf(attempt),
    summary: {
      questionCount: questions.length,
      correct: count("correct"),
      incorrect: count("incorrect"),
      unanswered: count("unanswered"),
      hintsUsed: results.filter((result) => result.hintUsed).length,
      correctWithHint: results.filter((result) => result.outcome === "correct" && result.hintUsed).length,
      /** Worth practising again: answered wrong, skipped, or solved only with a hint. */
      problemQuestionIds: questions.filter((question) => !isClean(question.childResult)).map((question) => question.id),
    },
    questions,
  };
}

/**
 * Every submitted attempt of one test by one child, oldest first, across all
 * versions of the test. Questions are matched by id; the newest version the
 * child took supplies their wording and order.
 */
export function buildTestHistoryReport(attempts: readonly AdminAttempt[]) {
  const latest = attempts[attempts.length - 1];
  const reviews = attempts.map((attempt) => reviewAttemptQuestions(attempt));

  const questionsById = new Map<string, StoredQuestion>();
  for (const review of [...reviews].reverse()) {
    for (const { question } of review) {
      if (!questionsById.has(question.id)) questionsById.set(question.id, question);
    }
  }

  const questions = [...questionsById.values()].map((question) => {
    const timeline = reviews.flatMap((review, index) => {
      const entry = review.find((item) => item.question.id === question.id);
      return entry
        ? [{
            attempt: index + 1,
            version: attempts[index].assignment.test.version,
            outcome: outcomeOf(entry),
            hintUsed: entry.hintUsed,
            answer: childAnswer(entry),
          }]
        : [];
    });
    const count = (outcome: Outcome) => timeline.filter((entry) => entry.outcome === outcome).length;

    return {
      ...uploadFormat(question),
      history: {
        attempts: timeline.length,
        correct: count("correct"),
        correctWithHint: timeline.filter((entry) => entry.outcome === "correct" && entry.hintUsed).length,
        incorrect: count("incorrect"),
        unanswered: count("unanswered"),
        hintsUsed: timeline.filter((entry) => entry.hintUsed).length,
        lastOutcome: timeline[timeline.length - 1].outcome,
        trend: trendOf(timeline),
        timeline,
      },
    };
  });
  const percentages = attempts.flatMap((attempt) => (attempt.result ? [attempt.result.percentage] : []));
  const idsWithTrend = (trend: Trend) => questions.filter((question) => question.history.trend === trend).map((question) => question.id);

  return {
    reportVersion: REPORT_VERSION,
    scope: "test",
    exportedAt: new Date().toISOString(),
    child: childOf(latest),
    test: {
      stableId: latest.assignment.test.stableId,
      title: latest.assignment.test.title,
      subject: latest.assignment.test.subject.slug,
      grade: latest.assignment.test.grade,
      passPercentage: latest.assignment.test.passPercentage,
      versions: [...new Set(attempts.map((attempt) => attempt.assignment.test.version))].sort((first, second) => first - second),
    },
    attempts: attempts.map((attempt, index) => {
      const outcomes = reviews[index].map(outcomeOf);
      return {
        number: index + 1,
        id: attempt.id,
        version: attempt.assignment.test.version,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        result: resultOf(attempt),
        correct: outcomes.filter((outcome) => outcome === "correct").length,
        incorrect: outcomes.filter((outcome) => outcome === "incorrect").length,
        unanswered: outcomes.filter((outcome) => outcome === "unanswered").length,
        hintsUsed: reviews[index].filter((entry) => entry.hintUsed).length,
      };
    }),
    summary: {
      attemptCount: attempts.length,
      passedAttempts: attempts.filter((attempt) => attempt.result?.passed).length,
      bestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
      latestPercentage: latest.result?.percentage ?? null,
      questionCount: questions.length,
      masteredQuestionIds: idsWithTrend("mastered"),
      improvedQuestionIds: idsWithTrend("improved"),
      regressedQuestionIds: idsWithTrend("regressed"),
      strugglingQuestionIds: idsWithTrend("struggling"),
      /** Every question that was wrong, skipped or hinted at least once. */
      problemQuestionIds: questions.filter((question) => question.history.trend !== "mastered").map((question) => question.id),
    },
    questions,
  };
}

/** Sends a report as a JSON file; `name` is reduced to filename-safe characters. */
export function reportDownload(report: object, name: string) {
  const filename = name.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
