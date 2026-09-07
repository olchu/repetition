/** Store half-stars as integers. Test grading weights do not affect rewards. */
export function rewardUnits(
  questions: ReadonlyArray<{ id: string; correctOptionId: string }>,
  answers: ReadonlyArray<{ questionId: string; optionId: string }>,
  hintQuestionIds: readonly string[],
) {
  const selected = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const hinted = new Set(hintQuestionIds);
  return questions.reduce((total, question) => total + (
    selected.get(question.id) === question.correctOptionId ? (hinted.has(question.id) ? 1 : 2) : 0
  ), 0);
}
