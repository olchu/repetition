# Repetition

Закрытый веб-сервис для учебных тестов детей.

Сервис планируется на React/Next.js и PostgreSQL. Администратор загружает тесты JSON-файлами, назначает их детям или группам, а дети проходят тесты и видят прогресс по предметам.

## Документация

- [Требования к продукту](docs/PRODUCT.md)
- [Формат теста и JSON Schema](docs/TEST-FORMAT.md)
- [JSON Schema](docs/test.schema.json)
- [API и модель данных](docs/API-DRAFT.md)
- [Экраны и критерии приёмки](docs/SCREENS.md)

Документы описывают согласованный черновик первой версии и явно отмечают решения, которые ещё нужно принять до разработки.

## Локальная разработка

Требуется Node.js 20.9 или новее.

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

Для API и локальной базы:

```bash
cp .env.example .env
npm run db:validate
npm run db:migrate -- --name init
SEED_ADMIN_PASSWORD="replace-this-password" npm run db:seed
```

В PostgreSQL должна существовать база `repetition`. Команда seed создаёт одного администратора из `SEED_ADMIN_LOGIN` и `SEED_ADMIN_PASSWORD`.

Проверки перед коммитом:


```bash
npm run lint
npm run build
```
