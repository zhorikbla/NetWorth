// Выполняется один раз перед всеми тестами и один раз после.
//
// 1. Проверяет, что имя БД оканчивается на _test (защита рабочей базы).
// 2. Пересоздаёт схему public и применяет SQL-миграции из prisma/migrations.
// 3. Создаёт системные роли user и admin.
// 4. Запускает сервер (node src/index.js) на тестовой БД и тестовом порту.
// 5. Проверяет, что сервер пишет именно в тестовую БД.
//
// Код бэкенда не меняется: сервер запускается как обычный процесс,
// нужные значения передаются через переменные окружения.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import {
  API_URL,
  JWT_SECRET,
  PASSWORD,
  ROOT,
  TEST_DATABASE_URL,
  TEST_PORT,
  TEST_RESULTS_DIR,
} from "./config.js";

let server;

export async function setup() {
  try {
    assertTestDatabaseName();
    await resetDatabase();
    await assertPortFree();
    startServer();
    await waitForHealth();
    await assertServerUsesTestDatabase();
  } catch (error) {
    // Печатаем причину сами: Vitest не всегда показывает текст ошибки из globalSetup.
    console.error(`\n[подготовка тестов] ${error.message}\n`);
    await teardown();
    process.exit(1);
  }
}

export async function teardown() {
  if (server && server.exitCode === null) server.kill();
}

function assertTestDatabaseName() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Имя тестовой БД должно оканчиваться на _test, сейчас "${dbName}". ` +
        "Тесты удаляют все данные, поэтому рабочую БД использовать нельзя."
    );
  }
}

async function resetDatabase() {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Нет подключения к тестовой БД ${TEST_DATABASE_URL}.\n` +
        "Создайте базу networth_test и проверьте TEST_DATABASE_URL.\n" +
        `Исходная ошибка: ${error.message}`
    );
  }
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const migrationsDir = path.join(ROOT, "prisma", "migrations");
    const migrations = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of migrations) {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      await client.query(sql);
    }
    await client.query("INSERT INTO role (role_name) VALUES ('user'), ('admin')");
  } finally {
    await client.end();
  }
}

function assertPortFree() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(TEST_PORT, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      reject(
        new Error(
          `Порт ${TEST_PORT} уже занят. Остановите процесс на нём или задайте TEST_PORT.`
        )
      );
    });
    socket.once("error", () => resolve());
  });
}

function startServer() {
  const logDir = TEST_RESULTS_DIR;
  fs.mkdirSync(logDir, { recursive: true });
  const log = fs.openSync(path.join(logDir, "server.log"), "w");

  server = spawn(process.execPath, ["src/index.js"], {
    cwd: ROOT,
    // dotenv в src/index.js не перезаписывает уже заданные переменные,
    // поэтому значения ниже важнее, чем .env разработчика.
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(TEST_PORT),
      JWT_SECRET,
      JWT_EXPIRES_IN: "1h",
      NODE_ENV: "test",
    },
    stdio: ["ignore", log, log],
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Сервер завершился при запуске, см. testing/test-results/server.log");
    }
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // сервер ещё не слушает порт
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Сервер не ответил на /api/health за 20 секунд, см. testing/test-results/server.log");
}

async function assertServerUsesTestDatabase() {
  const email = `sentinel.${Date.now()}@test.local`;
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, nickname: "sentinel", password: PASSWORD }),
  });
  if (response.status !== 201) {
    throw new Error(`Не удалось зарегистрировать контрольного пользователя: ${response.status}`);
  }
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM "user" WHERE email = $1', [email]);
    if (rowCount !== 1) {
      throw new Error("Сервер подключился не к тестовой БД. Проверьте DATABASE_URL.");
    }
  } finally {
    await client.end();
  }
}
