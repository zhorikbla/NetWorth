// Проверка prisma/seed.js на тестовой БД.
// Seed запускается как отдельный процесс с DATABASE_URL тестовой базы.
// Остальные тесты не используют данные seed, поэтому запуск безопасен.
import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, test } from "vitest";
import { query } from "../helpers/db.js";
import { ROOT, TEST_DATABASE_URL } from "../setup/config.js";

const SEED_EMAILS = ["admin@example.com", "nikita@example.com", "olga@example.com"];

function runSeed() {
  const result = spawnSync(process.execPath, ["prisma/seed.js"], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`seed завершился с кодом ${result.status}:\n${result.stderr}`);
  }
}

const countSeedRows = (table) =>
  query(
    `SELECT count(*)::int AS n FROM ${table} t JOIN "user" u USING (user_id)
     WHERE u.email = ANY($1)`,
    [SEED_EMAILS]
  ).then(([row]) => row.n);

describe("prisma/seed.js", () => {
  beforeAll(() => {
    runSeed();
  });

  test("SEED-01 создаёт трёх пользователей с bcrypt-хешами и нужными ролями", async () => {
    const users = await query(
      `SELECT u.email, u.password, r.role_name FROM "user" u JOIN role r USING (role_id)
       WHERE u.email = ANY($1) ORDER BY u.email`,
      [SEED_EMAILS]
    );
    expect(users.map((u) => [u.email, u.role_name])).toEqual([
      ["admin@example.com", "admin"],
      ["nikita@example.com", "user"],
      ["olga@example.com", "user"],
    ]);
    expect(users.every((u) => u.password.startsWith("$2b$"))).toBe(true);
  });

  test("SEED-02 по три тестовые категории, операции и лимита", async () => {
    expect(await countSeedRows("category")).toBe(3);
    expect(await countSeedRows("operation")).toBe(3);
    expect(await countSeedRows('"limit"')).toBe(3);
  });

  test.fails("SEED-03 [BR-15] повторный запуск seed не создаёт дубликаты", async () => {
    runSeed();
    expect(await countSeedRows("category")).toBe(3);
  });
});
