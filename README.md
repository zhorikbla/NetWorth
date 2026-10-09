# NETWORTH — backend

Node.js/Express сервер + PostgreSQL через Prisma ORM.
Этот этап (неделя 1): подключение к БД и тестовые данные.

## 1. Установка зависимостей

```bash
npm install
```

## 2. Настройка подключения к БД

1. Убедитесь, что локально установлен и запущен PostgreSQL.
2. Создайте базу данных:
   ```bash
   createdb networth
   ```
   (или через psql: `CREATE DATABASE networth;`)
3. Скопируйте `.env.example` в `.env` и подставьте свои логин/пароль от Postgres:
   ```bash
   cp .env.example .env
   ```

## 3. Применить схему БД (создать таблицы)

```bash
npm run prisma:migrate -- --name init
```

Эта команда создаст таблицы `user`, `role`, `category`, `operation`, `limit`
по схеме в `prisma/schema.prisma` и сгенерирует Prisma Client.

## 4. Заполнить тестовыми данными

```bash
npm run prisma:seed
```

Создаст:
- 2 роли (`user`, `admin`) — справочник, не тестовые данные
- 3 пользователя
- 3 категории
- 3 операции
- 3 лимита

Пароль у всех тестовых пользователей: `password123` (захеширован через bcrypt,
в БД хранится только хеш).

## 5. Запустить сервер

```bash
npm start
```

Проверить, что всё подключено:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/users
```

## Структура проекта

```
prisma/
  schema.prisma   — описание таблиц и связей (по ERD)
  seed.js         — тестовые данные
src/
  db.js           — единый Prisma Client на всё приложение
  index.js        — Express-сервер
.env.example      — шаблон переменных окружения
```

## Полезно посмотреть данные глазами

```bash
npx prisma studio
```

Откроет веб-интерфейс на localhost:5555 со всеми таблицами и записями —
удобно для демонстрации преподавателю, что данные реально легли в БД.
