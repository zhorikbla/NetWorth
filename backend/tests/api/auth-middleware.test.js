// Проверка токена (раздел 2.1). Все защищённые маршруты используют один и тот же
// middleware, поэтому подробные случаи проверяются на GET /api/users/me,
// а затем отдельно проверяется, что middleware подключён к каждому маршруту.
import { beforeAll, describe, expect, test } from "vitest";
import jwt from "jsonwebtoken";
import { api, get } from "../helpers/api.js";
import { createUser, signToken } from "../helpers/factories.js";

const NO_TOKEN = "Токен авторизации не передан";
const BAD_FORMAT = "Используйте формат Authorization: Bearer TOKEN";
const INVALID = "Недействительный или просроченный токен";

const me = (authorization) =>
  get("/api/users/me", { headers: authorization ? { Authorization: authorization } : {} });

describe("Авторизация по JWT", () => {
  let user;

  beforeAll(async () => {
    user = await createUser();
  });

  test("MW-01 без заголовка Authorization -> 401", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(NO_TOKEN);
  });

  test.each([
    ["другая схема", (t) => `Token ${t}`],
    ["Bearer без токена", () => "Bearer"],
    ["токен без Bearer", (t) => t],
  ])("MW-02 неверный формат заголовка (%s) -> 401", async (_name, build) => {
    const res = await me(build(user.token));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(BAD_FORMAT);
  });

  test("MW-03 произвольная строка вместо токена -> 401", async () => {
    const res = await me("Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(INVALID);
  });

  test("MW-04 просроченный токен -> 401", async () => {
    const expired = signToken({ user_id: user.id, role: "user" }, { expiresIn: -10 });
    const res = await me(`Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(INVALID);
  });

  test("MW-05 токен, подписанный чужим секретом -> 401", async () => {
    const forged = jwt.sign({ user_id: user.id, role: "admin" }, "attacker-secret");
    const res = await me(`Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test("MW-06 токен без подписи (alg none) -> 401", async () => {
    const unsigned = jwt.sign({ user_id: user.id, role: "admin" }, null, { algorithm: "none" });
    const res = await me(`Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });

  test("MW-07 действующий токен -> 200", async () => {
    const res = await me(`Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  // Если кто-то забудет подключить authMiddleware к новому маршруту, упадёт этот тест.
  test.each([
    ["GET", "/api/users/me"],
    ["PATCH", "/api/users/me"],
    ["DELETE", "/api/users/me"],
    ["GET", "/api/categories"],
    ["POST", "/api/categories"],
    ["PATCH", "/api/categories/1"],
    ["DELETE", "/api/categories/1"],
    ["GET", "/api/operations"],
    ["GET", "/api/operations/1"],
    ["POST", "/api/operations"],
    ["PATCH", "/api/operations/1"],
    ["DELETE", "/api/operations/1"],
    ["GET", "/api/limits"],
    ["POST", "/api/limits"],
    ["PATCH", "/api/limits/1"],
    ["DELETE", "/api/limits/1"],
    ["GET", "/api/stats/summary"],
    ["GET", "/api/stats/by-category"],
    ["GET", "/api/stats/timeline"],
    ["GET", "/api/admin/users"],
    ["PATCH", "/api/admin/users/1/role"],
    ["DELETE", "/api/admin/users/1"],
  ])("MW-08 %s %s без токена -> 401", async (method, path) => {
    const res = await api(method, path, method === "GET" ? {} : { body: {} });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(NO_TOKEN);
  });
});
