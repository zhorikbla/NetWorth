# NETWORTH

Учебный full-stack трекер личных финансов.

Стек: PostgreSQL, Prisma ORM, Node.js, Express, React, Vite, Recharts, JWT, bcrypt и Swagger.

## Возможности

- регистрация и вход по JWT;
- изоляция данных пользователей на backend;
- создание, просмотр, изменение и удаление доходов и расходов;
- создание, изменение и удаление пользовательских категорий;
- месячные лимиты по категориям и расчёт остатка;
- сводка, история и круговая диаграмма по категориям;
- изменение профиля, email и пароля;
- тёмная и светлая темы;
- адаптивная вёрстка;
- Swagger UI по адресу `/api-docs`.

## Структура проекта

```text
backend/             Express API, Prisma, миграции и seed
frontend/            React-приложение и конфигурация Vite
testing/             отдельный пакет интеграционных тестов API и БД
prototype/           первоначальные статические index.html и mock.json
package.json         общие команды для всего проекта
```

Frontend и backend являются соседними приложениями. У каждого собственные зависимости и `package.json`, а корневой `package.json` только запускает их общими командами.

## Локальная установка

Нужны Node.js 20.19+ и PostgreSQL.

```bash
git clone https://github.com/zhorikbla/NetWorth.git
cd NetWorth
npm run setup
cp backend/.env.example backend/.env
```

Создайте базу `networth`, заполните `backend/.env`, затем примените миграции и тестовые данные:

```bash
npm --prefix backend run prisma:deploy
npm --prefix backend run prisma:seed
```

Запустите приложения в двух терминалах:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

- React: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api-docs

В режиме разработки Vite перенаправляет запросы `/api` на Express через proxy из `frontend/vite.config.js`.

## Как здесь работает Vite

`frontend/index.html` — входной HTML-файл. Он подключает `frontend/src/main.jsx`, а тот монтирует React-приложение.

- `npm run dev:frontend` запускает dev-сервер Vite с быстрым обновлением страницы при изменении кода;
- `npm --prefix frontend run build` собирает оптимизированные HTML, CSS и JavaScript в `frontend/dist`;
- `npm --prefix frontend run preview` локально показывает именно production-сборку;
- в production Express раздаёт содержимое `frontend/dist` и возвращает `index.html` для маршрутов React Router.

Проект уже создан и настроен на Vite. Команда `npm create vite@latest frontend -- --template react` нужна только при создании нового frontend с нуля — сейчас повторно запускать её нельзя.

## Production-сборка без Docker

```bash
npm run build
npm run start:prod
```

`build` генерирует Prisma Client и собирает React в `frontend/dist`. `start:prod` применяет уже созданные production-миграции и запускает Express. После сборки frontend и API доступны с одного порта, по умолчанию `3000`.

Для PaaS-хостинга используйте:

```text
Build command: npm run setup && npm run build
Start command: npm run start:prod
```

На хостинге должны быть заданы `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` и при необходимости `PORT`. Docker проекту не требуется.

## Переменные окружения

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/networth"
JWT_SECRET="длинная-случайная-строка"
JWT_EXPIRES_IN="1h"
PORT=3000
```

Если frontend и backend размещаются на разных доменах, перед сборкой frontend дополнительно задайте:

```env
VITE_API_URL="https://api.example.com/api"
```

Переменные с префиксом `VITE_` попадают в клиентскую сборку, поэтому секреты в них хранить нельзя. Для текущего однодоменного варианта `VITE_API_URL` не нужна.

## Тесты

Тесты используют отдельную базу, имя которой обязательно заканчивается на `_test`. Рабочая база `networth` не очищается.

Создайте локальную базу один раз:

```bash
createdb networth_test
```

Затем запускайте:

```bash
npm test
```

Подробности находятся в `testing/README.md`.

## Проверки перед отправкой

```bash
npm run lint
npm run build
npm --prefix backend run prisma:validate
npm test
```

Проверка запущенного сервера:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db-check
```
