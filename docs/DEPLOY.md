# Деплой: Supabase + Vercel

Приложение не хранит файлов на диске: всё состояние — в PostgreSQL. База — Supabase (регион eu-central-1, Frankfurt — он же виден в хосте пулера `aws-0-eu-central-1.pooler.supabase.com`), приложение — Vercel. С базой приложение работает через Prisma ORM; интеграция Vercel «Prisma Postgres» — это другой хостинг баз, её не подключаем.

## Supabase

1. **Project Settings → Data API**: выключить. Приложение ходит в Postgres напрямую, а Data API открыл бы таблицы схемы `public` (логины, хэши паролей, сессии) по публичному ключу — у таблиц Prisma нет RLS.
2. **Connect → ORMs → Prisma**: две строки подключения. Вместо `[YOUR-PASSWORD]` — пароль базы (сбросить: Project Settings → Database). Строку *Direct connection* (`db.<ref>.supabase.co`) не использовать: на бесплатном тарифе она только по IPv6, Vercel её не достанет.

| Переменная | Строка Supabase | Кто использует |
| --- | --- | --- |
| `DATABASE_URL` | Transaction pooler, порт **6543**, с `?pgbouncer=true&connection_limit=1` | Приложение. `pgbouncer=true` — Prisma в режиме transaction pooler, `connection_limit=1` — одно соединение на функцию Vercel |
| `DIRECT_URL` | Session pooler, порт **5432** | Prisma CLI (миграции): `prisma.config.ts` берёт её вместо `DATABASE_URL`, если она задана |
| `SHADOW_DATABASE_URL` | — | Только локально, для `prisma migrate dev`. На проде не задавать |

Supabase выдаёт API-ролям `anon` и `authenticated` права на таблицы схемы `public`. Поэтому на всех таблицах включён RLS без политик (миграция `20260913120000_enable_row_level_security`): через Data API они закрыты, даже если его включить. Приложение это не затрагивает — оно подключается под владельцем таблиц (`postgres` в Supabase, с `bypassrls`), а RLS его не ограничивает. Миграция, которая добавляет таблицу, должна включить RLS и на ней; `tests/rls.integration.cjs` падает, если таблица без RLS.

Бесплатный проект засыпает примерно через неделю без активности (будится в панели), автоматических бэкапов на нём практически нет — периодически делать `pg_dump`.

## Локально: строки Supabase — в отдельном файле

Строки лежат в `.env.supabase`, а не в `.env`: в `.env` — локальная база, с которой работают `npm run dev`, интеграционные тесты (они создают и удаляют данные) и `prisma migrate dev`. Файл закрыт `.gitignore` (`.env*`). `prisma.config.ts` читает переменные через `dotenv/config`, а `DOTENV_CONFIG_PATH` подменяет файл:

```bash
DOTENV_CONFIG_PATH=.env.supabase npx prisma migrate status
DOTENV_CONFIG_PATH=.env.supabase npx prisma migrate deploy
DOTENV_CONFIG_PATH=.env.supabase SEED_ADMIN_LOGIN=admin SEED_ADMIN_PASSWORD='надёжный-пароль' npm run db:seed
```

`migrate deploy` только применяет готовые миграции из `prisma/migrations`; `migrate dev` на проде не запускать. Сид создаёт администратора или, если он уже есть, сбрасывает ему пароль.

## Перенос данных из локальной базы

Схема в обеих базах одна (те же миграции), поэтому переносятся только данные. Выгрузка — без журнала миграций и без сессий (на новом домене они бесполезны, пользователи просто входят заново):

```bash
pg_dump --data-only --no-owner --no-privileges --schema=public \
  --exclude-table-data='public."_prisma_migrations"' --exclude-table-data='public."Session"' \
  -f local-data.sql "postgresql://…локальная база без ?schema=public"
```

Загрузка — одной транзакцией по `DIRECT_URL` (session pooler): сначала `TRUNCATE … CASCADE` всех таблиц, кроме `_prisma_migrations` (миграции уже засеяли предметы), затем `\i local-data.sql`; запуск `psql --single-transaction -v ON_ERROR_STOP=1`. Либо переносится всё, либо ничего. После — сверить число строк по таблицам. Файл выгрузки содержит хэши паролей и данные детей: хранить только локально и удалить после переноса.

## Vercel

1. При импорте проекта интеграцию «Prisma Postgres» пропустить (Skip).
2. Settings → Environment Variables: `DATABASE_URL` и `DIRECT_URL` из таблицы выше — для Production и Preview: без `DATABASE_URL` не запустится `prisma generate`, и сборка упадёт.
3. Settings → Build and Deployment → Build Command:
   ```bash
   prisma generate && if [ "$VERCEL_ENV" = "production" ]; then prisma migrate deploy; fi && next build
   ```
   Vercel кэширует `node_modules`, поэтому клиент Prisma генерируется при каждой сборке. Миграции применяются только в production-сборке и до выхода новой версии: у preview-сборок та же база, и миграция из незамёрженной ветки иначе попала бы в прод.
4. Регион функций закреплён в `vercel.json` (`"regions": ["fra1"]`, Frankfurt) — рядом с базой; настройка в панели не нужна и этим файлом перекрывается. Это главное для скорости: один API-запрос кабинета — это проверка сессии и около 16 последовательных запросов к базе (замер для `loadStudentOverview`). В одном регионе обращение к базе занимает 1–2 мс, из региона по умолчанию (`iad1`, США) — около 90 мс, и страница собирается секундами. Проверить регион: заголовок ответа API `x-vercel-id` — вторая часть (`…::fra1::…`) и есть регион функции.
5. HTTPS Vercel даёт сам. Он обязателен: в production cookie сессии ставится с флагом `secure`.
