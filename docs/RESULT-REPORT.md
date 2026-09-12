# Отчёты по результатам (JSON)

Отчёты нужны, чтобы разобрать, где у ребёнка трудности, и собрать по ним новый тест. Их два, оба доступны только администратору, код — `src/lib/result-report.ts`.

| Отчёт | Где в админке | Endpoint | Файл |
| --- | --- | --- | --- |
| Одна попытка (`scope: "attempt"`) | Results → View answers → **Download JSON** | `GET /api/v1/admin/attempts/:attemptId/report` | `result-<логин>-<тест>-v<версия>-<дата>.json` |
| Все попытки теста (`scope: "test"`) | Results → выбрать ребёнка и тест → **Download all attempts** | `GET /api/v1/admin/results/report?childId=…&stableId=…` | `results-<логин>-<тест>-all-attempts-<дата>.json` |

## Общее

- Вопросы записаны в формате загрузки тестов ([TEST-FORMAT.md](./TEST-FORMAT.md)): `id`, `type`, `text`, `points`, `options` + `correctOptionId` или `correctAnswers`, `hint`, `explanation`. Пустые `hint` и `explanation` опущены, как в исходном файле. Результаты ребёнка лежат в одном отдельном поле (`childResult` или `history`); если его убрать, остаётся вопрос, который проходит схему загрузки.
- **Чистый ответ** — верный и без подсказки. Всё остальное (неверно, пропущено, верно только с подсказкой) считается проблемой.
- `hintUsed` — подсказка открыта **до** ответа; просмотр после проверки не учитывается. У попыток, начатых до появления наград, всегда `false`: тогда подсказки не записывались.
- Ответ ребёнка: `{ "optionId": "b", "text": "Только песок" }` для выбора, `{ "value": "2,4" }` для ввода (строка как её ввёл ребёнок), `null`, если ответа нет.

## Одна попытка

```json
{
  "reportVersion": "1.0",
  "scope": "attempt",
  "exportedAt": "2026-09-12T15:30:00.000Z",
  "child": { "displayName": "Маша", "login": "masha", "grade": "5" },
  "test": { "stableId": "science-plants-01", "version": 2, "title": "Растения", "subject": "science", "grade": "5", "passPercentage": 70 },
  "attempt": { "id": "…", "status": "submitted", "startedAt": "…", "submittedAt": "…" },
  "result": { "earnedPoints": 1, "totalPoints": 2, "percentage": 50, "passed": false },
  "summary": {
    "questionCount": 2, "correct": 1, "incorrect": 1, "unanswered": 0,
    "hintsUsed": 1, "correctWithHint": 1,
    "problemQuestionIds": ["q1", "q2"]
  },
  "questions": [
    {
      "id": "q1", "type": "choice", "text": "Что нужно растению для фотосинтеза?", "points": 1,
      "options": [{ "id": "a", "text": "Свет" }, { "id": "b", "text": "Только песок" }],
      "correctOptionId": "a",
      "childResult": { "outcome": "correct", "hintUsed": true, "answer": { "optionId": "a", "text": "Свет" }, "earnedPoints": 1 }
    }
  ]
}
```

`childResult.outcome` — `correct`, `incorrect` или `unanswered`. `summary.problemQuestionIds` — вопросы без чистого ответа.

## Все попытки теста

Берутся все **сданные** попытки ребёнка по тесту, от старой к новой, по всем версиям одного `stableId`: пересохранённый тест считается тем же тестом, как в прогрессе и наградах. Вопросы сопоставляются по `id`; текст и порядок берутся из самой новой версии, которую проходил ребёнок, а вопросы, которые были только в старых версиях, идут в конце. Если в новой версии под тем же `id` оказался другой вопрос, их история смешается — `id` в новых версиях менять нельзя (см. [TEST-STORAGE.md](./TEST-STORAGE.md), 5.3).

```json
{
  "reportVersion": "1.0",
  "scope": "test",
  "exportedAt": "…",
  "child": { "displayName": "Маша", "login": "masha", "grade": "5" },
  "test": { "stableId": "science-plants-01", "title": "Растения", "subject": "science", "grade": "5", "passPercentage": 70, "versions": [1, 2] },
  "attempts": [
    { "number": 1, "id": "…", "version": 1, "startedAt": "…", "submittedAt": "…", "result": { "earnedPoints": 1, "totalPoints": 2, "percentage": 50, "passed": false }, "correct": 1, "incorrect": 1, "unanswered": 0, "hintsUsed": 0 },
    { "number": 2, "id": "…", "version": 2, "startedAt": "…", "submittedAt": "…", "result": { "earnedPoints": 1, "totalPoints": 2, "percentage": 50, "passed": false }, "correct": 1, "incorrect": 1, "unanswered": 0, "hintsUsed": 0 }
  ],
  "summary": {
    "attemptCount": 2, "passedAttempts": 0, "bestPercentage": 50, "latestPercentage": 50, "questionCount": 2,
    "masteredQuestionIds": [], "improvedQuestionIds": ["q2"], "regressedQuestionIds": ["q1"], "strugglingQuestionIds": [],
    "problemQuestionIds": ["q1", "q2"]
  },
  "questions": [
    {
      "id": "q1", "type": "choice", "text": "…", "points": 1, "options": ["…"], "correctOptionId": "a",
      "history": {
        "attempts": 2, "correct": 1, "correctWithHint": 0, "incorrect": 1, "unanswered": 0, "hintsUsed": 0,
        "lastOutcome": "incorrect",
        "trend": "regressed",
        "timeline": [
          { "attempt": 1, "version": 1, "outcome": "correct", "hintUsed": false, "answer": { "optionId": "a", "text": "Свет" } },
          { "attempt": 2, "version": 2, "outcome": "incorrect", "hintUsed": false, "answer": { "optionId": "b", "text": "Только песок" } }
        ]
      }
    }
  ]
}
```

`history.trend` — итог по вопросу за все попытки:

| `trend` | Значит |
| --- | --- |
| `mastered` | Чистый ответ в каждой попытке. |
| `improved` | В последней попытке чистый ответ, раньше были проблемы. |
| `regressed` | Раньше был чистый ответ, в последней попытке — нет. |
| `struggling` | Чистого ответа не было ни разу. |

`summary.problemQuestionIds` — все вопросы, кроме `mastered`. Для нового теста в первую очередь стоит взять `regressedQuestionIds` и `strugglingQuestionIds`.

## Как собрать новый тест

Убрать у вопросов `childResult` / `history`, оставить нужные `id`, дописать поля верхнего уровня (`schemaVersion`, новый `id`, `title`, `subject`, `grade`) и загрузить. Или отдать отчёт языковой модели вместе с [test.schema.json](./test.schema.json) и попросить: «составь новый тест в этом формате на те же темы, что вопросы из `regressedQuestionIds` и `strugglingQuestionIds`».
