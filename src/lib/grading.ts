import type { StoredQuestion } from "./test-content";

/** What the child sent for one question: an option id, or the value they typed. */
export type SubmittedAnswer = { optionId: string | null; value: string | null };

/** Longest value accepted for an input question. */
export const MAX_ANSWER_LENGTH = 200;

const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * Reads a typed value as a number, or null when it is not one. The decimal
 * separator may be a dot or a comma and spaces between digit groups are
 * ignored, so "2,3", "2.30" and " 2.3 " are all the same number.
 */
function parseNumber(value: string) {
  const compact = value.replace(/\s+/g, "").replace(/−/g, "-");
  return NUMBER.test(compact) ? Number(compact.replace(",", ".")) : null;
}

/** Case, extra spaces, ё/е and the separator inside numbers ("3,5 кг") do not matter. */
function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е").replace(/(\d),(?=\d)/g, "$1.");
}

/**
 * Whether a typed value matches one of the accepted answers of an input
 * question. An accepted answer that is a number is compared by value, anything
 * else as normalised text.
 */
export function matchesAcceptedAnswer(value: string, acceptedAnswers: readonly string[]) {
  const number = parseNumber(value);
  const text = normalizeText(value);
  return acceptedAnswers.some((accepted) => {
    const expected = parseNumber(accepted);
    return expected === null ? normalizeText(accepted) === text : number === expected;
  });
}

/** The single place that decides whether an answer is right, for grading, stars and review. */
export function isAnswerCorrect(question: StoredQuestion, answer: SubmittedAnswer | undefined) {
  if (!answer) return false;
  return question.type === "input"
    ? answer.value !== null && matchesAcceptedAnswer(answer.value, question.correctAnswers)
    : answer.optionId === question.correctOptionId;
}
