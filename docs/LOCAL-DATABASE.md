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

Запуск как фоновой macOS-службы:

```bash
brew services start postgresql@16
```

Проверка готовности:

```bash
pg_isready -h localhost -p 5432
```

Ожидаемый результат содержит `accepting connections`.

Полезные команды:

```bash
brew services list
brew services restart postgresql@16
brew services stop postgresql@16
```

После `brew services start` PostgreSQL будет запускаться автоматически при входе в macOS.

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
brew services start postgresql@16
npm run dev
```

Если служба уже запущена, повторный `start` не требуется.

## 6. Типовые проблемы

### `psql: command not found`

Проверьте `PATH`:

```bash
echo $PATH
which psql
```

Для Apple Silicon ожидается путь `/opt/homebrew/opt/postgresql@16/bin/psql`.

### `connection refused`

Проверьте состояние службы и запустите её:

```bash
brew services list
brew services start postgresql@16
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
