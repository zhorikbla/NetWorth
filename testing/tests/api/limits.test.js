// Лимиты (раздел 7). Лимит действует на месяц даты data;
// spent = расходы этой категории за этот месяц, remaining = limit_summ - spent.
import { beforeAll, describe, expect, test } from "vitest";
import { del, get, patch, post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import { createCategory, createLimit, createOperation, createUser } from "../helpers/factories.js";

let alice;
let food;
let bob;
let bobCategory;
let bobLimit;

beforeAll(async () => {
  alice = await createUser({ nickname: "alice" });
  food = await createCategory(alice, "Еда");
  bob = await createUser({ nickname: "bob" });
  bobCategory = await createCategory(bob, "Чужая");
  bobLimit = await createLimit(bob, { category_id: bobCategory.category_id, limit_summ: 5000 });
});

const create = (body) => post("/api/limits", { token: alice.token, body });

async function limitRow(id) {
  const [row] = await query('SELECT * FROM "limit" WHERE limit_id = $1', [id]);
  return row;
}

describe("POST /api/limits", () => {
  test("LIM-01 создание -> 201, владелец из токена", async () => {
    const category = await createCategory(alice, "Транспорт");
    const res = await create({ category_id: category.category_id, data: "2026-10-01", limit_summ: 15000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      limit_id: expect.any(Number),
      category_id: category.category_id,
      data: "2026-10-01T00:00:00.000Z",
      user_id: alice.id,
    });
    expect(Number(res.body.limit_summ)).toBe(15000);
  });

  test.each([
    ["category_id = 0", { category_id: 0 }, "category_id должен быть положительным целым числом"],
    ["limit_summ = 0", { limit_summ: 0 }, "limit_summ должен быть положительным числом"],
    ["limit_summ < 0", { limit_summ: -100 }, "limit_summ должен быть положительным числом"],
    ["limit_summ-текст", { limit_summ: "много" }, "limit_summ должен быть положительным числом"],
    ["без data", { data: undefined }, "Некорректная дата в поле data"],
    ["data не дата", { data: "октябрь" }, "Некорректная дата в поле data"],
  ])("LIM-02 %s -> 400", async (_name, override, message) => {
    const res = await create({ category_id: food.category_id, data: "2026-12-01", limit_summ: 100, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("LIM-03 чужая категория -> 404", async () => {
    const res = await create({ category_id: bobCategory.category_id, data: "2026-10-01", limit_summ: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Категория не найдена");
  });

  test("LIM-04 повтор на ту же дату -> 409", async () => {
    const category = await createCategory(alice, "Дубль");
    await createLimit(alice, { category_id: category.category_id, data: "2026-10-01" });
    const res = await create({ category_id: category.category_id, data: "2026-10-01", limit_summ: 200 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Лимит для этой категории и месяца уже существует");
  });

  test("LIM-05 второй лимит в том же месяце (другой день) -> 409", async () => {
    const category = await createCategory(alice, "Месяц");
    await createLimit(alice, { category_id: category.category_id, data: "2026-10-01" });
    const res = await create({ category_id: category.category_id, data: "2026-10-15", limit_summ: 200 });
    expect(res.status).toBe(409);
  });

  test.fails("LIM-06 [BR-07] limit_summ больше DECIMAL(12,2) -> 400, а не 500", async () => {
    const res = await create({ category_id: food.category_id, data: "2027-01-01", limit_summ: 1e12 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/limits: spent и remaining", () => {
  let user;
  let cat;
  let other;
  let octLimit;
  let emptyLimit;

  // Набор подобран так, чтобы каждая ошибка в подсчёте меняла результат:
  // учитываются только расходы этой категории в октябре.
  beforeAll(async () => {
    user = await createUser({ nickname: "spender" });
    cat = await createCategory(user, "Еда");
    other = await createCategory(user, "Другое");
    octLimit = await createLimit(user, { category_id: cat.category_id, data: "2026-10-01", limit_summ: 1000 });
    emptyLimit = await createLimit(user, { category_id: other.category_id, data: "2026-12-01", limit_summ: 500 });

    await createOperation(user, { category_id: cat.category_id, kind: "expense", summ: 300, data: "2026-10-05" });
    await createOperation(user, { category_id: cat.category_id, kind: "expense", summ: 150.5, data: "2026-10-31T20:00:00Z" });
    await createOperation(user, { category_id: cat.category_id, kind: "income", summ: 9999, data: "2026-10-10" });
    await createOperation(user, { category_id: cat.category_id, kind: "expense", summ: 70, data: "2026-11-01" });
    await createOperation(user, { category_id: cat.category_id, kind: "expense", summ: 80, data: "2026-09-30" });
    await createOperation(user, { category_id: other.category_id, kind: "expense", summ: 40, data: "2026-10-05" });
  });

  const list = (qs = "") => get(`/api/limits${qs}`, { token: user.token });
  const find = (res, id) => res.body.find((l) => l.limit_id === id);

  test("LIM-07 spent учитывает только расходы категории за месяц лимита", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    const limit = find(res, octLimit.limit_id);
    expect(Number(limit.spent)).toBe(450.5);
    expect(limit.remaining).toBe(549.5);
  });

  test("LIM-08 без расходов: spent = 0, remaining = limit_summ", async () => {
    const limit = find(await list(), emptyLimit.limit_id);
    expect(Number(limit.spent)).toBe(0);
    expect(limit.remaining).toBe(500);
  });

  test("LIM-09 перерасход даёт отрицательный remaining", async () => {
    const category = await createCategory(user, "Перерасход");
    const limit = await createLimit(user, { category_id: category.category_id, data: "2026-08-01", limit_summ: 100 });
    await createOperation(user, { category_id: category.category_id, summ: 130, data: "2026-08-20" });
    expect(find(await list(), limit.limit_id).remaining).toBe(-30);
  });

  test("LIM-10 в списке только свои лимиты", async () => {
    const res = await list();
    expect(res.body.map((l) => l.limit_id)).not.toContain(bobLimit.limit_id);
  });

  test("LIM-11 фильтр category_id; неверный фильтр -> 400", async () => {
    const res = await list(`?category_id=${other.category_id}`);
    expect(res.body.map((l) => l.limit_id)).toEqual([emptyLimit.limit_id]);

    const bad = await list("?category_id=-1");
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("category_id должен быть положительным целым числом");
  });

  test.fails("LIM-12 [BR-13] spent всегда число, как remaining", async () => {
    const res = await list();
    expect(typeof find(res, octLimit.limit_id).spent).toBe("number");
    expect(typeof find(res, emptyLimit.limit_id).spent).toBe("number");
  });
});

describe("PATCH /api/limits/:id", () => {
  test("LIM-13 изменение суммы и даты -> 200 и сохраняется", async () => {
    const category = await createCategory(alice, "Правка");
    const limit = await createLimit(alice, { category_id: category.category_id });
    const res = await patch(`/api/limits/${limit.limit_id}`, {
      token: alice.token,
      body: { data: "2026-11-01", limit_summ: 12000 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toBe("2026-11-01T00:00:00.000Z");
    expect(Number((await limitRow(limit.limit_id)).limit_summ)).toBe(12000);
  });

  test.each([
    [{}, "Нечего изменять — передайте data или limit_summ"],
    [{ limit_summ: 0 }, "limit_summ должен быть положительным числом"],
    [{ data: "не дата" }, "Некорректная дата в поле data"],
  ])("LIM-14 тело %o -> 400", async (body, message) => {
    const category = await createCategory(alice, "Валидация");
    const limit = await createLimit(alice, { category_id: category.category_id });
    const res = await patch(`/api/limits/${limit.limit_id}`, { token: alice.token, body });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("LIM-15 перенос на дату существующего лимита -> 409", async () => {
    const category = await createCategory(alice, "Коллизия");
    await createLimit(alice, { category_id: category.category_id, data: "2026-10-01" });
    const second = await createLimit(alice, { category_id: category.category_id, data: "2026-11-01" });
    const res = await patch(`/api/limits/${second.limit_id}`, { token: alice.token, body: { data: "2026-10-01" } });
    expect(res.status).toBe(409);
  });

  test("LIM-16 чужой лимит -> 404, сумма не меняется", async () => {
    const res = await patch(`/api/limits/${bobLimit.limit_id}`, { token: alice.token, body: { limit_summ: 1 } });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Лимит не найден");
    expect(Number((await limitRow(bobLimit.limit_id)).limit_summ)).toBe(5000);
  });

  test("LIM-17 некорректный ID -> 400", async () => {
    const res = await patch("/api/limits/abc", { token: alice.token, body: { limit_summ: 1 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некорректный ID лимита");
  });
});

describe("DELETE /api/limits/:id", () => {
  test("LIM-18 свой лимит -> 204", async () => {
    const category = await createCategory(alice, "Удаление");
    const limit = await createLimit(alice, { category_id: category.category_id });
    const res = await del(`/api/limits/${limit.limit_id}`, { token: alice.token });
    expect(res.status).toBe(204);
    expect(await limitRow(limit.limit_id)).toBeUndefined();
  });

  test("LIM-19 чужой лимит -> 404, запись остаётся; несуществующий -> 404", async () => {
    const res = await del(`/api/limits/${bobLimit.limit_id}`, { token: alice.token });
    expect(res.status).toBe(404);
    expect(await limitRow(bobLimit.limit_id)).toBeDefined();
    expect((await del("/api/limits/999999", { token: alice.token })).status).toBe(404);
  });

  test("LIM-20 некорректный ID -> 400", async () => {
    const res = await del("/api/limits/-5", { token: alice.token });
    expect(res.status).toBe(400);
  });
});
