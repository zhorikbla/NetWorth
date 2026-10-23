// Регистрация и вход (раздел 3).
import { beforeAll, describe, expect, test } from "vitest";
import jwt from "jsonwebtoken";
import { post } from "../helpers/api.js";
import { query } from "../helpers/db.js";
import { createUser, uniqueEmail } from "../helpers/factories.js";
import { PASSWORD } from "../setup/config.js";

const register = (body) => post("/api/auth/register", { body });
const login = (body) => post("/api/auth/login", { body });

describe("POST /api/auth/register", () => {
  test("AUTH-01 успешная регистрация -> 201, роль user, пароля в ответе нет", async () => {
    const email = uniqueEmail("reg");
    const res = await register({ email, nickname: "Аня", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: expect.any(Number),
      email,
      nickname: "Аня",
      role: { role_name: "user" },
    });
    expect(res.text).not.toContain(PASSWORD);
  });

  test("AUTH-02 email приводится к нижнему регистру, пробелы по краям убираются", async () => {
    const email = uniqueEmail("case");
    const res = await register({ email: `  ${email.toUpperCase()} `, nickname: "  Ann  ", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.nickname).toBe("Ann");
  });

  test("AUTH-03 пароль хранится в БД как bcrypt-хеш", async () => {
    const email = uniqueEmail("hash");
    await register({ email, nickname: "hash", password: PASSWORD });

    const [row] = await query('SELECT password FROM "user" WHERE email = $1', [email]);
    expect(row.password).not.toBe(PASSWORD);
    expect(row.password).toMatch(/^\$2[aby]\$10\$/);
  });

  test.each(["email", "nickname", "password"])(
    "AUTH-04 без поля %s -> 400",
    async (field) => {
      const body = { email: uniqueEmail(), nickname: "Аня", password: PASSWORD };
      delete body[field];
      const res = await register(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Email, nickname и pasword обязательны");
    }
  );

  test("AUTH-05 email без @ -> 400", async () => {
    const res = await register({ email: "user.example.com", nickname: "Аня", password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некорректный email");
  });

  // Граничные значения: 1 символ после trim -> ошибка, ровно 2 -> успех.
  test("AUTH-06 nickname из 1 символа (после trim) -> 400", async () => {
    const res = await register({ email: uniqueEmail(), nickname: "  a  ", password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Nickname должен содержать минимум 2 символа");
  });

  test("AUTH-07 nickname ровно из 2 символов -> 201", async () => {
    const res = await register({ email: uniqueEmail(), nickname: "ab", password: PASSWORD });
    expect(res.status).toBe(201);
  });

  test("AUTH-08 пароль из 7 символов -> 400", async () => {
    const res = await register({ email: uniqueEmail(), nickname: "Аня", password: "1234567" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Пароль должен содержать минимум 8 символа");
  });

  test("AUTH-09 пароль ровно из 8 символов -> 201", async () => {
    const res = await register({ email: uniqueEmail(), nickname: "Аня", password: "12345678" });
    expect(res.status).toBe(201);
  });

  test("AUTH-10 повторный email, в том числе в другом регистре -> 409", async () => {
    const email = uniqueEmail("dup");
    expect((await register({ email, nickname: "first", password: PASSWORD })).status).toBe(201);

    for (const sameEmail of [email, email.toUpperCase()]) {
      const res = await register({ email: sameEmail, nickname: "second", password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Пользователь с таким email уже существует");
    }
  });

  test("AUTH-11 email-число -> 400", async () => {
    const res = await register({ email: 12345, nickname: "Аня", password: PASSWORD });
    expect(res.status).toBe(400);
  });

  test("AUTH-12 nickname-число -> 400", async () => {
    const res = await register({ email: uniqueEmail(), nickname: 12345, password: PASSWORD });
    expect(res.status).toBe(400);
  });

  test("AUTH-13 password-число -> 400", async () => {
    const res = await register({ email: uniqueEmail(), nickname: "Аня", password: 12345678 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  let user;

  beforeAll(async () => {
    user = await createUser({ nickname: "login" });
  });

  test("AUTH-14 успешный вход -> 200, токен и профиль", async () => {
    const res = await login({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      user_id: user.id,
      nickname: "login",
      email: user.email,
      role: "user",
    });
    const payload = jwt.decode(res.body.token);
    expect(payload).toMatchObject({ user_id: user.id, role: "user" });
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test("AUTH-15 email в другом регистре и с пробелами -> 200", async () => {
    const res = await login({ email: ` ${user.email.toUpperCase()} `, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  // Одинаковый ответ не даёт узнать, зарегистрирован ли email.
  test.each([
    ["неверный пароль", () => ({ email: user.email, password: "wrong-password" })],
    ["несуществующий email", () => ({ email: uniqueEmail("ghost"), password: PASSWORD })],
  ])("AUTH-16 %s -> 401 с одинаковым текстом", async (_name, build) => {
    const res = await login(build());
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Неверный email или пароль");
  });

  test.each(["email", "password"])("AUTH-17 без поля %s -> 400", async (field) => {
    const body = { email: user.email, password: PASSWORD };
    delete body[field];
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email и password должны быть не пустыми строками");
  });

  test("AUTH-18 email-число при входе -> 400", async () => {
    const res = await login({ email: 12345, password: PASSWORD });
    expect(res.status).toBe(400);
  });
});
