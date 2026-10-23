// Администрирование (раздел 9).
import { beforeAll, describe, expect, test } from "vitest";
import { del, get, patch, post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import { createCategory, createLimit, createOperation, createUser, login } from "../helpers/factories.js";
import { PASSWORD } from "../setup/config.js";

const FORBIDDEN = "Доступ разрешён только администратору";

let admin;
let user;

beforeAll(async () => {
  admin = await createUser({ nickname: "admin", role: "admin", prefix: "admin" });
  user = await createUser({ nickname: "regular" });
});

const setRole = (id, body, token = admin.token) => patch(`/api/admin/users/${id}/role`, { token, body });

async function roleOf(userId) {
  const [row] = await query(
    'SELECT r.role_name FROM "user" u JOIN role r USING (role_id) WHERE u.user_id = $1',
    [userId]
  );
  return row?.role_name;
}

describe("Доступ только для admin", () => {
  test.each([
    ["GET /api/admin/users", () => get("/api/admin/users", { token: user.token })],
    ["PATCH role", () => setRole(user.id, { role_name: "admin" }, user.token)],
    ["DELETE user", () => del(`/api/admin/users/${admin.id}`, { token: user.token })],
  ])("ADM-01 обычный пользователь: %s -> 403", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(FORBIDDEN);
  });

  test("ADM-02 после 403 роль пользователя не изменилась", async () => {
    await setRole(user.id, { role_name: "admin" }, user.token);
    expect(await roleOf(user.id)).toBe("user");
  });
});

describe("GET /api/admin/users", () => {
  test("ADM-03 список всех пользователей по ID, без паролей", async () => {
    const res = await get("/api/admin/users", { token: admin.token });
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ user_id: user.id, nickname: "regular", email: user.email, role: "user" });
    expect(res.body).toContainEqual({ user_id: admin.id, nickname: "admin", email: admin.email, role: "admin" });
    const ids = res.body.map((u) => u.user_id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(res.body.every((u) => !("password" in u))).toBe(true);
  });
});

describe("PATCH /api/admin/users/:id/role", () => {
  test("ADM-04 назначение admin -> 200; старый токен хранит старую роль до нового входа", async () => {
    const target = await createUser({ nickname: "promoted" });
    const res = await setRole(target.id, { role_name: "admin" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: target.id, nickname: "promoted", email: target.email, role: "admin" });
    expect(await roleOf(target.id)).toBe("admin");

    // Поведение описано в документации: роль зашита в JWT.
    expect((await get("/api/admin/users", { token: target.token })).status).toBe(403);
    const freshToken = await login(target.email);
    expect((await get("/api/admin/users", { token: freshToken })).status).toBe(200);
  });

  test("ADM-05 обратно в user -> 200", async () => {
    const target = await createUser({ role: "admin" });
    const res = await setRole(target.id, { role_name: "user" });
    expect(res.status).toBe(200);
    expect(await roleOf(target.id)).toBe("user");
  });

  test.each([[{}], [{ role_name: "superadmin" }], [{ role_name: "ADMIN" }]])(
    "ADM-06 недопустимая роль %o -> 400",
    async (body) => {
      const res = await setRole(user.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("role_name должен быть user или admin");
    }
  );

  test("ADM-07 своя роль -> 400", async () => {
    const res = await setRole(admin.id, { role_name: "user" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Нельзя изменить собственную роль");
    expect(await roleOf(admin.id)).toBe("admin");
  });

  test("ADM-08 несуществующий пользователь -> 404; некорректный ID -> 400", async () => {
    const missing = await setRole(999999, { role_name: "user" });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("Пользователь не найден");

    const bad = await setRole("abc", { role_name: "user" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Некорректный ID пользователя");
  });
});

describe("DELETE /api/admin/users/:id", () => {
  test("ADM-09 удаление пользователя вместе с его данными -> 204", async () => {
    const victim = await createUser({ nickname: "victim" });
    const category = await createCategory(victim);
    await createOperation(victim, { category_id: category.category_id });
    await createLimit(victim, { category_id: category.category_id });

    const res = await del(`/api/admin/users/${victim.id}`, { token: admin.token });
    expect(res.status).toBe(204);

    for (const table of ['"user"', "category", "operation", '"limit"']) {
      expect(await query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [victim.id]), table).toHaveLength(0);
    }
    const relogin = await post("/api/auth/login", { body: { email: victim.email, password: PASSWORD } });
    expect(relogin.status).toBe(401);
  });

  test("ADM-10 удаление самого себя -> 400", async () => {
    const res = await del(`/api/admin/users/${admin.id}`, { token: admin.token });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "Нельзя удалить самого себя через admin-эндпоинт — используйте DELETE /api/users/me"
    );
  });

  test("ADM-11 несуществующий -> 404; некорректный ID -> 400", async () => {
    expect((await del("/api/admin/users/999999", { token: admin.token })).status).toBe(404);
    const bad = await del("/api/admin/users/1.5", { token: admin.token });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Некорректный ID пользователя");
  });
});
