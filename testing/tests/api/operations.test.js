// Операции (раздел 6). summ в ответе приходит строкой (Prisma Decimal),
// поэтому суммы сравниваются через Number().
import { beforeAll, describe, expect, test } from "vitest";
import { del, get, patch, post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import { createCategory, createOperation, createUser } from "../helpers/factories.js";

let alice;
let aliceFood;
let aliceSalary;
let bob;
let bobCategory;
let bobOperation;

beforeAll(async () => {
  alice = await createUser({ nickname: "alice" });
  aliceFood = await createCategory(alice, "Еда");
  aliceSalary = await createCategory(alice, "Зарплата");
  bob = await createUser({ nickname: "bob" });
  bobCategory = await createCategory(bob, "Чужая");
  bobOperation = await createOperation(bob, { category_id: bobCategory.category_id, summ: 777 });
});

const create = (body, user = alice) => post("/api/operations", { token: user.token, body });

async function operationRow(id) {
  const [row] = await query("SELECT * FROM operation WHERE operation_id = $1", [id]);
  return row;
}

describe("POST /api/operations", () => {
  test("OP-01 создание со всеми полями -> 201", async () => {
    const res = await create({
      summ: 350.5,
      kind: "expense",
      category_id: aliceFood.category_id,
      data: "2026-10-16",
      comment: "  Покупка  ",
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      operation_id: expect.any(Number),
      summ: expect.anything(),
      data: "2026-10-16T00:00:00.000Z",
      kind: "expense",
      comment: "Покупка",
      category_id: aliceFood.category_id,
    });
    expect(Number(res.body.summ)).toBe(350.5);

    const row = await operationRow(res.body.operation_id);
    expect(row.user_id).toBe(alice.id);
  });

  test("OP-02 без data -> дата равна текущему моменту", async () => {
    const before = Date.now();
    const res = await create({ summ: 10, kind: "income", category_id: aliceSalary.category_id });
    expect(res.status).toBe(201);
    const saved = new Date(res.body.data).getTime();
    expect(saved).toBeGreaterThanOrEqual(before - 1000);
    expect(saved).toBeLessThanOrEqual(Date.now() + 1000);
    expect(res.body.comment).toBeNull();
  });

  test.each([
    ["без summ", { summ: undefined }, "summ должен быть положительным числом"],
    ["summ = 0", { summ: 0 }, "summ должен быть положительным числом"],
    ["summ < 0", { summ: -5 }, "summ должен быть положительным числом"],
    ["summ-текст", { summ: "abc" }, "summ должен быть положительным числом"],
    ["kind не из списка", { kind: "transfer" }, "kind должен быть income или expense"],
    ["без kind", { kind: undefined }, "kind должен быть income или expense"],
    ["category_id = 0", { category_id: 0 }, "category_id должен быть положительным целым числом"],
    ["category_id дробный", { category_id: 1.5 }, "category_id должен быть положительным целым числом"],
    ["data не дата", { data: "not-a-date" }, "Некорректная дата в поле data"],
    ["comment-число", { comment: 123 }, "comment должен быть строкой"],
  ])("OP-03 %s -> 400", async (_name, override, message) => {
    const res = await create({ summ: 100, kind: "expense", category_id: aliceFood.category_id, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("OP-04 несколько ошибок объединяются через '; '", async () => {
    const res = await create({ summ: -1, kind: "x", category_id: aliceFood.category_id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("summ должен быть положительным числом; kind должен быть income или expense");
  });

  test("OP-05 чужая категория -> 404, операция не создаётся", async () => {
    const [{ count: before }] = await query("SELECT count(*)::int FROM operation WHERE user_id = $1", [alice.id]);
    const res = await create({ summ: 100, kind: "expense", category_id: bobCategory.category_id });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Категория не найдена");
    const [{ count: after }] = await query("SELECT count(*)::int FROM operation WHERE user_id = $1", [alice.id]);
    expect(after).toBe(before);
  });

  test.fails("OP-06 [BR-06] summ = 0.001 -> 400 (сейчас сохраняется операция на 0)", async () => {
    const res = await create({ summ: 0.001, kind: "expense", category_id: aliceFood.category_id });
    expect(res.status).toBe(400);
  });

  test.fails("OP-07 [BR-07] summ больше DECIMAL(12,2) -> 400, а не 500", async () => {
    const res = await create({ summ: 1e12, kind: "expense", category_id: aliceFood.category_id });
    expect(res.status).toBe(400);
  });

  test.fails("OP-08 [BR-11] несуществующая дата 2026-02-30 -> 400 (сейчас 2026-03-02)", async () => {
    const res = await create({ summ: 1, kind: "expense", category_id: aliceFood.category_id, data: "2026-02-30" });
    expect(res.status).toBe(400);
  });

  test.fails("OP-09 [BR-11] data = null -> 400 (сейчас 1970-01-01)", async () => {
    const res = await create({ summ: 1, kind: "expense", category_id: aliceFood.category_id, data: null });
    expect(res.status).toBe(400);
  });

  test.fails("OP-10 [BR-12] summ = true -> 400 (сейчас сохраняется 1)", async () => {
    const res = await create({ summ: true, kind: "expense", category_id: aliceFood.category_id });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/operations", () => {
  let user;
  let food;
  let salary;
  let ops;

  // Отдельный пользователь с известным набором операций, чтобы проверять точные списки.
  beforeAll(async () => {
    user = await createUser({ nickname: "lister" });
    food = await createCategory(user, "Еда");
    salary = await createCategory(user, "Зарплата");
    ops = {
      jan: await createOperation(user, { category_id: food.category_id, kind: "expense", data: "2026-01-10" }),
      mar: await createOperation(user, { category_id: salary.category_id, kind: "income", data: "2026-03-10" }),
      feb: await createOperation(user, { category_id: food.category_id, kind: "expense", data: "2026-02-10" }),
    };
  });

  const list = (qs = "") => get(`/api/operations${qs}`, { token: user.token });
  const ids = (res) => res.body.map((o) => o.operation_id);

  test("OP-11 только свои операции, новые первыми", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([ops.mar.operation_id, ops.feb.operation_id, ops.jan.operation_id]);
  });

  test("OP-12 пустой список для нового пользователя -> []", async () => {
    const fresh = await createUser();
    const res = await get("/api/operations", { token: fresh.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("OP-13 фильтр kind", async () => {
    expect(ids(await list("?kind=income"))).toEqual([ops.mar.operation_id]);
    expect(ids(await list("?kind=expense"))).toEqual([ops.feb.operation_id, ops.jan.operation_id]);
  });

  test("OP-14 фильтр category_id", async () => {
    expect(ids(await list(`?category_id=${salary.category_id}`))).toEqual([ops.mar.operation_id]);
  });

  test("OP-15 фильтр по датам включает обе границы", async () => {
    const res = await list("?date_from=2026-02-10&date_to=2026-03-10");
    expect(ids(res)).toEqual([ops.mar.operation_id, ops.feb.operation_id]);
  });

  test("OP-16 фильтр по чужой категории -> пустой список", async () => {
    const res = await list(`?category_id=${bobCategory.category_id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test.each([
    ["?kind=transfer", "kind должен быть income или expense"],
    ["?category_id=abc", "category_id должен быть положительным целым числом"],
    ["?date_from=abc", "Некорректная дата в поле date_from"],
    ["?date_to=abc", "Некорректная дата в поле date_to"],
    ["?date_from=abc&date_to=xyz", "Некорректная дата в поле date_from; Некорректная дата в поле date_to"],
  ])("OP-17 неверный фильтр %s -> 400", async (qs, message) => {
    const res = await list(qs);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("OP-18 date_to включает операции в течение всего дня", async () => {
    const late = await createOperation(user, {
      category_id: food.category_id,
      data: "2026-04-15T18:30:00.000Z",
    });
    const res = await list("?date_from=2026-04-15&date_to=2026-04-15");
    expect(ids(res)).toContain(late.operation_id);
  });
});

describe("GET /api/operations/:id", () => {
  test("OP-19 своя операция -> 200", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id, summ: 42 });
    const res = await get(`/api/operations/${op.operation_id}`, { token: alice.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(op);
  });

  test("OP-20 чужая операция -> 404, как будто её нет", async () => {
    const res = await get(`/api/operations/${bobOperation.operation_id}`, { token: alice.token });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Операция не найдена");
  });

  test("OP-21 несуществующая -> 404; некорректный ID -> 400", async () => {
    expect((await get("/api/operations/999999", { token: alice.token })).status).toBe(404);
    const bad = await get("/api/operations/abc", { token: alice.token });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Некорректный ID операции");
  });

  test.fails("OP-22 [BR-08] ID больше int4 -> 400, а не 500", async () => {
    const res = await get("/api/operations/99999999999", { token: alice.token });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/operations/:id", () => {
  test("OP-23 изменение всех полей своей операции -> 200 и сохраняется", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id });
    const res = await patch(`/api/operations/${op.operation_id}`, {
      token: alice.token,
      body: {
        summ: 999.99,
        kind: "income",
        data: "2026-05-05",
        comment: " новая ",
        category_id: aliceSalary.category_id,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      operation_id: op.operation_id,
      kind: "income",
      data: "2026-05-05T00:00:00.000Z",
      comment: "новая",
      category_id: aliceSalary.category_id,
    });
    expect(Number(res.body.summ)).toBe(999.99);

    const row = await operationRow(op.operation_id);
    expect(Number(row.summ)).toBe(999.99);
    expect(row.category_id).toBe(aliceSalary.category_id);
  });

  test("OP-24 изменение одного поля не трогает остальные", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id, summ: 50, comment: "было" });
    const res = await patch(`/api/operations/${op.operation_id}`, { token: alice.token, body: { summ: 60 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ comment: "было", kind: "expense", category_id: aliceFood.category_id });
  });

  test("OP-25 пустое тело -> 400 'Нечего изменять'", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id });
    const res = await patch(`/api/operations/${op.operation_id}`, { token: alice.token, body: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Нечего изменять");
  });

  test.each([
    [{ summ: 0 }, "summ должен быть положительным числом"],
    [{ kind: "gift" }, "kind должен быть income или expense"],
    [{ data: "31.12.2026" }, "Некорректная дата в поле data"],
    [{ comment: 5 }, "comment должен быть строкой"],
    [{ category_id: -3 }, "category_id должен быть положительным целым числом"],
  ])("OP-26 недопустимое значение %o -> 400", async (body, message) => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id });
    const res = await patch(`/api/operations/${op.operation_id}`, { token: alice.token, body });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("OP-27 перенос в чужую категорию -> 404, категория не меняется", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id });
    const res = await patch(`/api/operations/${op.operation_id}`, {
      token: alice.token,
      body: { category_id: bobCategory.category_id },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Категория не найдена");
    expect((await operationRow(op.operation_id)).category_id).toBe(aliceFood.category_id);
  });

  test("OP-28 чужая операция -> 404, данные не меняются", async () => {
    const res = await patch(`/api/operations/${bobOperation.operation_id}`, {
      token: alice.token,
      body: { summ: 1 },
    });
    expect(res.status).toBe(404);
    expect(Number((await operationRow(bobOperation.operation_id)).summ)).toBe(777);
  });
});

describe("DELETE /api/operations/:id", () => {
  test("OP-29 своя операция -> 204, затем 404", async () => {
    const op = await createOperation(alice, { category_id: aliceFood.category_id });
    const res = await del(`/api/operations/${op.operation_id}`, { token: alice.token });
    expect(res.status).toBe(204);
    expect(await operationRow(op.operation_id)).toBeUndefined();
    expect((await get(`/api/operations/${op.operation_id}`, { token: alice.token })).status).toBe(404);
  });

  test("OP-30 чужая операция -> 404, запись остаётся", async () => {
    const res = await del(`/api/operations/${bobOperation.operation_id}`, { token: alice.token });
    expect(res.status).toBe(404);
    expect(await operationRow(bobOperation.operation_id)).toBeDefined();
  });

  test("OP-31 некорректный ID -> 400", async () => {
    const res = await del("/api/operations/0", { token: alice.token });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некорректный ID операции");
  });
});
