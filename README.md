# Repetition

Закрытый веб-сервис для учебных тестов детей.

Сервис планируется на React/Next.js и PostgreSQL. Администратор загружает тесты JSON-файлами, назначает их детям или группам, а дети проходят тесты и видят прогресс по предметам.

## Документация

- [Требования к продукту](docs/PRODUCT.md)
- [Формат теста и JSON Schema](docs/TEST-FORMAT.md)
- [JSON Schema](docs/test.schema.json)
- [Хранение тестов: реализация и открытые вопросы](docs/TEST-STORAGE.md)
- [API и модель данных](docs/API-DRAFT.md)
- [Экраны и критерии приёмки](docs/SCREENS.md)

Документы описывают согласованный черновик первой версии и явно отмечают решения, которые ещё нужно принять до разработки.

## Локальная разработка

Требуется Node.js 20.9 или новее.

```bash
cd /Users/olchu/Documents/projects/pet/repetition
npm install
npm run dev
```

Откройте `http://localhost:3000`.

Для API и локальной базы PostgreSQL:

```bash
cp .env.example .env
createuser repetition_app
psql postgres -c "ALTER ROLE repetition_app WITH LOGIN PASSWORD 'repetition_local';"
createdb --owner=repetition_app repetition
createdb --owner=repetition_app repetition_shadow
npm run db:validate
npm run db:migrate -- --name init
SEED_ADMIN_PASSWORD="replace-this-password" npm run db:seed
```

Команды `createuser` и `createdb` нужны только один раз. Если роль или база уже существуют, их повторно создавать не нужно. Запуск PostgreSQL через Homebrew описан в `docs/LOCAL-DATABASE.md`.

Проверки перед коммитом:


```bash
npm run lint
npm run build
```
