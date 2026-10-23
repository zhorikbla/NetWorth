// Профиль пользователя (раздел 4).
import { beforeEach, describe, expect, test } from "vitest";
import { del, get, patch, post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import {
  createCategory,
  createLimit,
  createOperation,
  createUser,
  login,
  uniqueEmail,
} from "../helpers/factories.js";
import { PASSWORD } from "../setup/config.js";

// Профиль меняется в каждом тесте, поэтому пользователь создаётся заново перед каждым.
let user;
beforeEach(async () => {
  user = await createUser({ nickname: "profile" });
});

const update = (body) => patch("/api/users/me", { token: user.token, body });

describe("GET /api/users/me", () => {
  test("USR-01 возвращает профиль владельца токена", async () => {
    const res = await get("/api/users/me", { token: user.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: user.id, nickname: "profile", email: user.email, role: "user" });
  });
});

describe("PATCH /api/users/me", () => {
  test("USR-02 смена nickname сохраняется", async () => {
    const res = await update({ nickname: "  Новое имя  " });
    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe("Новое имя");

    const again = await get("/api/users/me", { token: user.token });
    expect(again.body.nickname).toBe("Новое имя");
  });

  test("USR-03 смена email: новый адрес нормализуется, вход по нему работает", async () => {
    const newEmail = uniqueEmail("moved");
    const res = await update({ email: newEmail.toUpperCase() });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(newEmail);

    expect(await login(newEmail)).toEqual(expect.any(String));
    const oldLogin = await post("/api/auth/login", { body: { email: user.email, password: PASSWORD } });
    expect(oldLogin.status).toBe(401);
  });

  test("USR-04 смена пароля: старый перестаёт работать, новый работает", async () => {
    const res = await update({ password: "newPassword123" });
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("newPassword123");

    const oldLogin = await post("/api/auth/login", { body: { email: user.email, password: PASSWORD } });
    expect(oldLogin.status).toBe(401);
    expect(await login(user.email, "newPassword123")).toEqual(expect.any(String));
  });

  test("USR-05 свой же email можно отправить повторно -> 200", async () => {
    const res = await update({ email: user.email });
    expect(res.status).toBe(200);
  });

  test.each([
    ["пустое тело", {}, "Нечего изменять — передайте nickname, email или password"],
    ["короткий nickname", { nickname: " a " }, "Nickname должен содержать минимум 2 символа"],
    ["email без @", { email: "no-at-sign" }, "Некорректный email"],
    ["короткий пароль", { password: "1234567" }, "Пароль должен содержать минимум 8 символов"],
    ["пароль-число", { password: 12345678 }, "Пароль должен содержать минимум 8 символов"],
  ])("USR-06 %s -> 400", async (_name, body, message) => {
    const res = await update(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  test("USR-07 email другого пользователя -> 409, профиль не меняется", async () => {
    const other = await createUser();
    const res = await update({ email: other.email });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Пользователь с таким email уже существует");

    const [row] = await query('SELECT email FROM "user" WHERE user_id = $1', [user.id]);
    expect(row.email).toBe(user.email);
  });

  test.fails("USR-08 [BR-12] nickname-число -> 400, а не сохранение как текст", async () => {
    const res = await update({ nickname: 12345 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/users/me", () => {
  test("USR-09 удаляет аккаунт и все его данные", async () => {
    const category = await createCategory(user, "Удаляемая");
    await createOperation(user, { category_id: category.category_id });
    await createLimit(user, { category_id: category.category_id });

    const res = await del("/api/users/me", { token: user.token });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    for (const table of ["category", "operation", '"limit"', '"user"']) {
      const rows = await query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [user.id]);
      expect(rows, table).toHaveLength(0);
    }
  });

  test("USR-10 после удаления вход невозможен, профиль по старому токену -> 404", async () => {
    await del("/api/users/me", { token: user.token });

    const loginRes = await post("/api/auth/login", { body: { email: user.email, password: PASSWORD } });
    expect(loginRes.status).toBe(401);

    const meRes = await get("/api/users/me", { token: user.token });
    expect(meRes.status).toBe(404);
    expect(meRes.body.error).toBe("Пользователь не найден");
  });

  test.fails("USR-11 [BR-14] токен удалённого пользователя: создание категории -> 401, а не 500", async () => {
    await del("/api/users/me", { token: user.token });
    const res = await post("/api/categories", { token: user.token, body: { name: "Призрак" } });
    expect(res.status).toBe(401);
  });
});
