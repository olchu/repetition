# Локальная PostgreSQL на macOS

Для Apple Silicon используется Homebrew из `/opt/homebrew`.

## 1. Установка

```bash
brew update
brew install postgresql@16
```

Добавьте клиентские команды PostgreSQL в `PATH`:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Проверьте установку:

```bash
psql --version
```

## 2. Запуск и остановка сервера

Сервер запускается вместе с проектом: `npm run dev` (`scripts/dev.mjs`) поднимает PostgreSQL, если он выключен, запускает Next, а после Ctrl+C останавливает сервер — но только если сам его поднял. Сервер, который уже работал до запуска, остаётся как был.

Для этого PostgreSQL не должен быть службой `brew services`: она запускает сервер при входе в macOS и перезапускает его при каждой остановке. Отключить её один раз:

```bash
brew services stop postgresql@16
```

Ручное управление — например, для интеграционных тестов без запущенного Next:

```bash
npm run db:status   # запущен ли сервер и не служба ли он brew
npm run db:start
npm run db:stop
```

`npm run dev:next` запускает только Next, не трогая базу. Проверка готовности: `pg_isready -h localhost -p 5432` — ожидается `accepting connections`. Лог сервера: `/opt/homebrew/var/log/postgresql@16.log`.

Вернуть автозапуск при входе в macOS: `brew services start postgresql@16`. Тогда `npm run dev` сервер не останавливает, а `npm run db:stop` подсказывает, как отключить службу.

## 3. Создание базы для Repetition

Выполнить один раз:

createuser repetition_app
psql postgres -c "ALTER ROLE repetition_app WITH LOGIN PASSWORD 'repetition_local';"
createdb --owner=repetition_app repetition
createdb --owner=repetition_app repetition_shadow

Проверка подключения:

```bash
psql "postgresql://repetition_app:repetition_local@localhost:5432/repetition" -c "SELECT current_database();"
```

В корне проекта создайте `.env`:

```bash
cp .env.example .env
```

В `.env` должны быть указаны оба URL:

```text
DATABASE_URL="postgresql://repetition_app:repetition_local@localhost:5432/repetition?schema=public"
SHADOW_DATABASE_URL="postgresql://repetition_app:repetition_local@localhost:5432/repetition_shadow?schema=public"
```

## 4. Создание таблиц и администратора

Из корня проекта:

```bash
npm run db:validate
npm run db:migrate -- --name init
SEED_ADMIN_LOGIN="admin" SEED_ADMIN_PASSWORD="your-local-password" npm run db:seed
```

После этого запускайте приложение:

```bash
npm run dev
```

Откройте `http://localhost:3000` и войдите:

- role: `I’m an admin`;
- username: значение `SEED_ADMIN_LOGIN`;
- password: значение `SEED_ADMIN_PASSWORD`.

## 5. Повседневный запуск

Если база уже создана, каждый раз достаточно:

```bash
npm run dev
```

PostgreSQL поднимется сам и остановится после Ctrl+C. Интеграционным тестам (`node --test tests/…`) нужна запущенная база: `npm run db:start` перед ними и `npm run db:stop` после, если Next не запущен.

## 6. Типовые проблемы

### `psql: command not found`

Проверьте `PATH`:

```bash
echo $PATH
which psql
```

Для Apple Silicon ожидается путь `/opt/homebrew/opt/postgresql@16/bin/psql`.

### `connection refused`

Сервер выключен — например, Next запущен через `npm run dev:next`. Проверьте и запустите его:

```bash
npm run db:status
npm run db:start
pg_isready -h localhost -p 5432
```

### `database "repetition" does not exist`

Создайте базу командой:

```bash
createdb --owner=repetition_app repetition
```

### `role "repetition_app" does not exist`

Создайте роль и задайте пароль:

```bash
createuser repetition_app
psql postgres -c "ALTER ROLE repetition_app WITH LOGIN PASSWORD 'repetition_local';"
```
