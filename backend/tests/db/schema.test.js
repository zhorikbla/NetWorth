// Тесты PostgreSQL: схема, ограничения и каскады.
// Каждый тест работает внутри транзакции, которая откатывается (ROLLBACK),
// поэтому база после тестов остаётся в исходном состоянии.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { connectClient } from "../helpers/db.js";

let client;

beforeAll(async () => {
  client = await connectClient();
});
afterAll(async () => {
  await client.end();
});
beforeEach(async () => {
  await client.query("BEGIN");
});
afterEach(async () => {
  await client.query("ROLLBACK");
});

async function rows(sql, params = []) {
  return (await client.query(sql, params)).rows;
}

// Выполняет запрос и возвращает код ошибки PostgreSQL (или null, если запрос прошёл).
// SAVEPOINT нужен, чтобы ошибка не "сломала" всю транзакцию теста.
async function errorCode(sql, params = []) {
  await client.query("SAVEPOINT attempt");
  try {
    await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT attempt");
    return null;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT attempt");
    return error.code;
  }
}

// Коды ошибок PostgreSQL
const UNIQUE = "23505";
const FOREIGN_KEY = "23503";
const NOT_NULL = "23502";
const CHECK = "23514";
const INVALID_ENUM = "22P02";
const NUMERIC_OVERFLOW = "22003";

// Минимальный набор данных внутри транзакции теста.
async function fixture() {
  const [user] = await rows(
    `INSERT INTO "user"(nickname, email, password, role_id)
     VALUES ('db', 'db.' || gen_random_uuid() || '@test.local', 'hash',
             (SELECT role_id FROM role WHERE role_name = 'user'))
     RETURNING user_id`
  );
  const [category] = await rows(
    "INSERT INTO category(name, user_id) VALUES ('Еда', $1) RETURNING category_id",
    [user.user_id]
  );
  return { userId: user.user_id, categoryId: category.category_id };
}

const insertOperation = (f, summ = 100, kind = "expense") =>
  errorCode(
    "INSERT INTO operation(summ, kind, user_id, category_id) VALUES ($1, $2, $3, $4)",
    [summ, kind, f.userId, f.categoryId]
  );

const insertLimit = (f, data = "2026-10-01", limitSumm = 1000) =>
  errorCode(
    'INSERT INTO "limit"(data, limit_summ, user_id, category_id) VALUES ($1, $2, $3, $4)',
    [data, limitSumm, f.userId, f.categoryId]
  );

describe("Структура", () => {
  test("DB-01 пять предметных таблиц", async () => {
    const result = await rows(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name`);
    expect(result.map((r) => r.table_name)).toEqual(["category", "limit", "operation", "role", "user"]);
  });

  test("DB-02 тип OperationKind содержит только income и expense", async () => {
    const result = await rows(`SELECT unnest(enum_range(NULL::"OperationKind"))::text AS kind`);
    expect(result.map((r) => r.kind)).toEqual(["income", "expense"]);
  });

  test("DB-03 суммы хранятся как DECIMAL(12,2)", async () => {
    const result = await rows(`
      SELECT table_name, column_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('summ', 'limit_summ')
      ORDER BY table_name`);
    expect(result).toEqual([
      { table_name: "limit", column_name: "limit_summ", numeric_precision: 12, numeric_scale: 2 },
      { table_name: "operation", column_name: "summ", numeric_precision: 12, numeric_scale: 2 },
    ]);
  });
});

describe("Ограничения", () => {
  test("DB-04 тип операции вне enum отклоняется", async () => {
    const f = await fixture();
    expect(await insertOperation(f, 100, "transfer")).toBe(INVALID_ENUM);
  });

  test("DB-05 email и role_name уникальны", async () => {
    const f = await fixture();
    const [user] = await rows(`SELECT email FROM "user" WHERE user_id = $1`, [f.userId]);
    expect(
      await errorCode(
        `INSERT INTO "user"(nickname, email, password, role_id)
         VALUES ('dup', $1, 'x', (SELECT role_id FROM role WHERE role_name = 'user'))`,
        [user.email]
      )
    ).toBe(UNIQUE);
    expect(await errorCode("INSERT INTO role(role_name) VALUES ('user')")).toBe(UNIQUE);
  });

  test("DB-06 обязательные поля NOT NULL", async () => {
    const f = await fixture();
    expect(
      await errorCode("INSERT INTO operation(summ, kind, user_id) VALUES (1, 'expense', $1)", [f.userId])
    ).toBe(NOT_NULL);
    expect(await errorCode("INSERT INTO category(name) VALUES ('Без владельца')")).toBe(NOT_NULL);
    expect(
      await errorCode(`INSERT INTO "user"(nickname, email, password) VALUES ('x', 'x@x', 'x')`)
    ).toBe(NOT_NULL);
  });

  test("DB-07 внешние ключи не допускают ссылок на несуществующие записи", async () => {
    const f = await fixture();
    expect(await insertOperation({ ...f, categoryId: 2147483000 })).toBe(FOREIGN_KEY);
    expect(await errorCode("INSERT INTO category(name, user_id) VALUES ('X', 2147483000)")).toBe(FOREIGN_KEY);
  });

  test("DB-08 сумма больше 9 999 999 999.99 отклоняется", async () => {
    const f = await fixture();
    expect(await insertOperation(f, "10000000000")).toBe(NUMERIC_OVERFLOW);
    expect(await insertOperation(f, "9999999999.99")).toBeNull();
  });

  test("DB-09 повторный лимит на ту же дату отклоняется", async () => {
    const f = await fixture();
    expect(await insertLimit(f, "2026-10-01")).toBeNull();
    expect(await insertLimit(f, "2026-10-01")).toBe(UNIQUE);
  });

  test("DB-10 операция с суммой 0 или меньше отклоняется", async () => {
    const f = await fixture();
    expect(await insertOperation(f, -1)).toBe(CHECK);
  });

  test("DB-11 лимит с суммой 0 отклоняется", async () => {
    const f = await fixture();
    expect(await insertLimit(f, "2026-12-01", 0)).toBe(CHECK);
  });

  test("DB-12 второй лимит в том же месяце отклоняется", async () => {
    const f = await fixture();
    expect(await insertLimit(f, "2026-10-01")).toBeNull();
    expect(await insertLimit(f, "2026-10-15")).toBe(CHECK);
  });
});

describe("Удаление и каскады", () => {
  test("DB-13 удаление пользователя удаляет его категории, операции и лимиты", async () => {
    const f = await fixture();
    await insertOperation(f);
    await insertLimit(f);

    await client.query('DELETE FROM "user" WHERE user_id = $1', [f.userId]);

    for (const table of ["category", "operation", '"limit"']) {
      expect(await rows(`SELECT 1 FROM ${table} WHERE user_id = $1`, [f.userId]), table).toHaveLength(0);
    }
  });

  test("DB-14 категорию с операциями удалить нельзя", async () => {
    const f = await fixture();
    await insertOperation(f);
    expect(await errorCode("DELETE FROM category WHERE category_id = $1", [f.categoryId])).toBe(FOREIGN_KEY);
  });

  test("DB-15 категорию с лимитами удалить нельзя", async () => {
    const f = await fixture();
    await insertLimit(f);
    expect(await errorCode("DELETE FROM category WHERE category_id = $1", [f.categoryId])).toBe(FOREIGN_KEY);
  });

  test("DB-16 роль, назначенную пользователю, удалить нельзя", async () => {
    await fixture();
    expect(await errorCode("DELETE FROM role WHERE role_name = 'user'")).toBe(FOREIGN_KEY);
  });
});
