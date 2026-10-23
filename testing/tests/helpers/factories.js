// Фабрики тестовых данных. Каждый тест создаёт собственных пользователей
// с уникальными email и не зависит от seed и от других тестов.
// Фабрика бросает ошибку, если API ответил не так, как ожидалось:
// тогда падает подготовка (beforeAll), а не проверка, и причина видна сразу.
import jwt from "jsonwebtoken";
import { post } from "./api.js";
import { query } from "./db.js";
import { JWT_SECRET, PASSWORD } from "../setup/config.js";

let counter = 0;

export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@test.local`;
}

function ensure(response, expectedStatus, what) {
  if (response.status !== expectedStatus) {
    throw new Error(`${what}: ожидался ${expectedStatus}, получен ${response.status} ${response.text}`);
  }
  return response.body;
}

export async function login(email, password = PASSWORD) {
  const response = await post("/api/auth/login", { body: { email, password } });
  return ensure(response, 200, "Вход").token;
}

// role: "user" | "admin". Админа нельзя создать через API, поэтому роль меняется в БД.
export async function createUser({ nickname = "tester", role = "user", prefix = "user" } = {}) {
  const email = uniqueEmail(prefix);
  const registered = ensure(
    await post("/api/auth/register", { body: { email, nickname, password: PASSWORD } }),
    201,
    "Регистрация"
  );
  if (role === "admin") {
    await query(
      `UPDATE "user" SET role_id = (SELECT role_id FROM role WHERE role_name = 'admin')
       WHERE user_id = $1`,
      [registered.user_id]
    );
  }
  const token = await login(email);
  return { id: registered.user_id, email, nickname, password: PASSWORD, token };
}

export async function createCategory(user, name = "Категория") {
  return ensure(
    await post("/api/categories", { token: user.token, body: { name } }),
    201,
    "Создание категории"
  );
}

export async function createOperation(user, fields) {
  return ensure(
    await post("/api/operations", {
      token: user.token,
      body: { summ: 100, kind: "expense", data: "2026-10-10", ...fields },
    }),
    201,
    "Создание операции"
  );
}

export async function createLimit(user, fields) {
  return ensure(
    await post("/api/limits", {
      token: user.token,
      body: { data: "2026-10-01", limit_summ: 1000, ...fields },
    }),
    201,
    "Создание лимита"
  );
}

export function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h", ...options });
}
