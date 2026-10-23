// Категории (раздел 5). Главное: пользователь не может видеть,
// менять и удалять чужие категории.
import { beforeAll, describe, expect, test } from "vitest";
import { del, get, patch, post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import { createCategory, createLimit, createOperation, createUser } from "../helpers/factories.js";

const INVALID_IDS = ["abc", "0", "-1", "1.5"];

let alice;
let bob;
let bobCategory;

beforeAll(async () => {
  alice = await createUser({ nickname: "alice" });
  bob = await createUser({ nickname: "bob" });
  bobCategory = await createCategory(bob, "Чужая категория");
});

async function categoryName(id) {
  const [row] = await query("SELECT name FROM category WHERE category_id = $1", [id]);
  return row?.name;
}

describe("POST /api/categories", () => {
  test("CAT-01 создание -> 201, имя без пробелов по краям, владелец из токена", async () => {
    const res = await post("/api/categories", { token: alice.token, body: { name: "  Развлечения  " } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ category_id: expect.any(Number), name: "Развлечения" });

    const [row] = await query("SELECT user_id FROM category WHERE category_id = $1", [res.body.category_id]);
    expect(row.user_id).toBe(alice.id);
  });

  test("CAT-02 user_id из тела запроса игнорируется", async () => {
    const res = await post("/api/categories", {
      token: alice.token,
      body: { name: "Подмена", user_id: bob.id },
    });
    expect(res.status).toBe(201);
    const [row] = await query("SELECT user_id FROM category WHERE category_id = $1", [res.body.category_id]);
    expect(row.user_id).toBe(alice.id);
  });

  test.each([
    ["без name", {}],
    ["name из 1 символа", { name: "a" }],
    ["name из пробелов и 1 символа", { name: "   a   " }],
    ["name-число", { name: 12345 }],
  ])("CAT-03 %s -> 400", async (_name, body) => {
    const res = await post("/api/categories", { token: alice.token, body });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Название категори должно содержать минимум 2 символа");
  });
});

describe("GET /api/categories", () => {
  test("CAT-04 в списке есть созданная категория, список отсортирован по ID", async () => {
    const created = await createCategory(alice, "Видна в списке");
    const res = await get("/api/categories", { token: alice.token });

    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ category_id: created.category_id, name: "Видна в списке", user_id: alice.id });
    const ids = res.body.map((c) => c.category_id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test("CAT-05 в списке только категории владельца токена", async () => {
    const res = await get("/api/categories", { token: alice.token });
    expect(res.body.every((c) => c.user_id === alice.id)).toBe(true);
  });
});

describe("PATCH /api/categories/:id", () => {
  test("CAT-06 переименование своей категории -> 200", async () => {
    const category = await createCategory(alice, "Старое имя");
    const res = await patch(`/api/categories/${category.category_id}`, {
      token: alice.token,
      body: { name: " Новое имя " },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ category_id: category.category_id, name: "Новое имя" });
    expect(await categoryName(category.category_id)).toBe("Новое имя");
  });

  test.each(INVALID_IDS)("CAT-07 некорректный ID '%s' -> 400", async (id) => {
    const res = await patch(`/api/categories/${id}`, { token: alice.token, body: { name: "Имя" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некорректный ID категории");
  });

  test("CAT-08 без name -> 400; короткий name -> 400", async () => {
    const category = await createCategory(alice);
    const url = `/api/categories/${category.category_id}`;

    const empty = await patch(url, { token: alice.token, body: {} });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("Нечего изменять — передайте поле name");

    const short = await patch(url, { token: alice.token, body: { name: "x" } });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe("Название категории должно содержать минимум 2 символа");
  });

  test("CAT-09 чужая категория -> 404, имя не меняется", async () => {
    const res = await patch(`/api/categories/${bobCategory.category_id}`, {
      token: alice.token,
      body: { name: "Взлом" },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Категория не найдена");
    expect(await categoryName(bobCategory.category_id)).toBe("Чужая категория");
  });

  test("CAT-10 несуществующая категория -> 404", async () => {
    const res = await patch("/api/categories/999999", { token: alice.token, body: { name: "Имя" } });
    expect(res.status).toBe(404);
  });

  test.fails("CAT-11 [BR-08] ID больше int4 -> 400, а не 500", async () => {
    const res = await patch("/api/categories/99999999999", { token: alice.token, body: { name: "Имя" } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/categories/:id", () => {
  test("CAT-12 удаление неиспользуемой категории -> 204", async () => {
    const category = await createCategory(alice, "На удаление");
    const res = await del(`/api/categories/${category.category_id}`, { token: alice.token });
    expect(res.status).toBe(204);
    expect(await categoryName(category.category_id)).toBeUndefined();
  });

  test("CAT-13 категория с операцией -> 409", async () => {
    const category = await createCategory(alice, "С операцией");
    await createOperation(alice, { category_id: category.category_id });

    const res = await del(`/api/categories/${category.category_id}`, { token: alice.token });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Нельзя удалить категорию, пока с ней связаны операции и лимиты");
  });

  test("CAT-14 категория с лимитом -> 409", async () => {
    const category = await createCategory(alice, "С лимитом");
    await createLimit(alice, { category_id: category.category_id });

    const res = await del(`/api/categories/${category.category_id}`, { token: alice.token });
    expect(res.status).toBe(409);
  });

  test("CAT-15 чужая категория -> 404, категория остаётся", async () => {
    const res = await del(`/api/categories/${bobCategory.category_id}`, { token: alice.token });
    expect(res.status).toBe(404);
    expect(await categoryName(bobCategory.category_id)).toBe("Чужая категория");
  });

  test.each(INVALID_IDS)("CAT-16 некорректный ID '%s' -> 400", async (id) => {
    const res = await del(`/api/categories/${id}`, { token: alice.token });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некорректный Id категории");
  });
});
