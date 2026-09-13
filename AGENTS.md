<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Предметы

Справочник предметов, названий, цветов и иконок хранится в таблице `Subject`; связи — `Test.subjectId` и `ChildSubject`. `src/lib/subjects.ts` содержит только типы и валидацию, описание: `docs/SUBJECTS.md`. Предметы назначаются ученику отдельно от тестов; на дашборде показываются только назначенные предметы.

## Вопросы и ответы

Типы вопросов `choice` (выбор варианта) и `input` (ввод в поле): `docs/TEST-FORMAT.md`, хранение — `docs/TEST-STORAGE.md`. Правильность любого ответа для баллов, звёзд и разбора определяет только `isAnswerCorrect` из `src/lib/grading.ts`; в числах запятая и точка равнозначны.

## Наборы тестов

Администратор объединяет тесты в наборы (`TestSet`, членство по `stableId`, тест максимум в одном наборе): `docs/TEST-SETS.md`. Списки ученика группируются `groupBySet` из `src/lib/student-progress.ts`, сводка наборов — `summarizeSets`; карточки тестов — `src/components/TestCard.tsx`, карточки наборов — `SetCard.tsx`, страница набора — `src/app/dashboard/sets/[setId]`.

## Деплой

Supabase + Vercel: `docs/DEPLOY.md`. Приложение ходит по `DATABASE_URL` (transaction pooler), Prisma CLI и миграции — по `DIRECT_URL` (session pooler): `prisma.config.ts` берёт её как `url`, а `directUrl` там в Prisma 6.19 для подключения не используется. Строки Supabase лежат в `.env.supabase`, не в `.env`. Все таблицы в `public` — с RLS без политик, чтобы Data API Supabase их не отдавал; миграция новой таблицы должна включать `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (проверяет `tests/rls.integration.cjs`).

## Награды

Правила звёзд и ограничения попыток: `docs/REWARDS.md`. Правильный ответ: 1 звезда, с подсказкой: 0,5; только первая попытка по stableId. Незавершённый тест можно только продолжить. Проверенные ответы неизменяемы. Все изменения попыток используют `withChildAttemptLock`.

## Следующий этап разработки

Согласованный пошаговый план кабинета ученика: `docs/STUDENT-NAVIGATION-PLAN.md`. Порядок: общая основа → Subjects → Progress → Tests → компактный Home. План пока не реализован; при работе отмечать выполненные шаги и сохранять различие завершённых тестов, сданных тестов и звёзд.
