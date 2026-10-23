// Единые настройки тестов. Любое значение можно переопределить переменной окружения.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

dotenv.config({ path: path.join(ROOT, ".env") });

function localTestDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    return "postgresql://postgres:postgres@localhost:5432/networth_test";
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/networth_test";
  return url.toString();
}

// По умолчанию используется отдельная networth_test рядом с локальной БД из .env.
// Имя обязано оканчиваться на _test: схема пересоздаётся перед каждым прогоном.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || localTestDatabaseUrl();

// Отдельный порт, чтобы не мешать серверу разработки на 3000.
export const TEST_PORT = Number(process.env.TEST_PORT || 3100);
export const API_URL = `http://localhost:${TEST_PORT}`;

// Секрет известен тестам: так можно подделать просроченный или чужой токен.
export const JWT_SECRET = "networth-test-secret";

export const PASSWORD = "password123";
