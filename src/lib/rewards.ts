import { isAnswerCorrect, type SubmittedAnswer } from "./grading";
import type { StoredQuestion } from "./test-content";

/** Store half-stars as integers. Test grading weights do not affect rewards. */
export function rewardUnits(
  questions: readonly StoredQuestion[],
  answers: ReadonlyArray<SubmittedAnswer & { questionId: string }>,
  hintQuestionIds: readonly string[],
) {
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const hinted = new Set(hintQuestionIds);
  return questions.reduce((total, question) => total + (
    isAnswerCorrect(question, answersByQuestion.get(question.id)) ? (hinted.has(question.id) ? 1 : 2) : 0
  ), 0);
}
