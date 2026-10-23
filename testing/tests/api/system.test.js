// Системные маршруты и общие правила API (раздел 2.2 и 10 документации).
import { describe, expect, test } from "vitest";
import { api, get, post } from "../helpers/api.js";

describe("Системные маршруты", () => {
  test("SYS-01 GET /api/health -> 200, status ok", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", message: "NETWORTH backend is still alive" });
  });

  test("SYS-02 GET /api/db-check -> 200, database connected", async () => {
    const res = await get("/api/db-check");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "connected" });
  });

  test("SYS-03 неизвестный маршрут -> 404 'Маршрут не найден'", async () => {
    const res = await get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Маршрут не найден" });
  });

  test("SYS-04 Swagger UI открывается на /api-docs/", async () => {
    const res = await get("/api-docs/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test.fails("SYS-05 [BR-10] битый JSON -> 400 с JSON-ошибкой без стектрейса", async () => {
    const res = await api("POST", "/api/auth/login", { raw: "{bad json" });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.text).not.toContain("node_modules");
  });

  test.fails("SYS-06 [BR-09] POST без тела запроса -> 400, а не 500", async () => {
    const res = await post("/api/auth/login");
    expect(res.status).toBe(400);
  });
});
