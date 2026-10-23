// Статистика (раздел 8). У пользователя заранее известный набор операций,
// поэтому все суммы проверяются точно, а не "больше нуля".
import { beforeAll, describe, expect, test } from "vitest";
import { get } from "../helpers/api.js";
import { createCategory, createOperation, createUser } from "../helpers/factories.js";

let user;
let food;
let salary;

beforeAll(async () => {
  user = await createUser({ nickname: "stats" });
  food = await createCategory(user, "Еда");
  salary = await createCategory(user, "Зарплата");
  await createOperation(user, { category_id: salary.category_id, kind: "income", summ: 1000, data: "2026-09-10" });
  await createOperation(user, { category_id: food.category_id, kind: "expense", summ: 300, data: "2026-09-15" });
  await createOperation(user, { category_id: food.category_id, kind: "expense", summ: 200.25, data: "2026-10-05" });
  await createOperation(user, { category_id: salary.category_id, kind: "income", summ: 500, data: "2026-10-20" });

  // Операции другого пользователя не должны попасть ни в одну сумму.
  const stranger = await createUser({ nickname: "stranger" });
  const strangerCat = await createCategory(stranger, "Чужая");
  await createOperation(stranger, { category_id: strangerCat.category_id, kind: "income", summ: 100000, data: "2026-10-01" });
});

const stats = (path, qs = "") => get(`/api/stats/${path}${qs}`, { token: user.token });
const OCTOBER = "?date_from=2026-10-01&date_to=2026-10-31";

describe("GET /api/stats/summary", () => {
  test("ST-01 без фильтров: доходы, расходы, баланс", async () => {
    const res = await stats("summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ income: 1500, expense: 500.25, balance: 999.75 });
  });

  test("ST-02 с фильтром по датам", async () => {
    const res = await stats("summary", OCTOBER);
    expect(res.body).toEqual({ income: 500, expense: 200.25, balance: 299.75 });
  });

  test("ST-03 у пользователя без операций нули", async () => {
    const fresh = await createUser();
    const res = await get("/api/stats/summary", { token: fresh.token });
    expect(res.body).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  test("ST-04 date_from позже date_to: 200 и нули, отдельной ошибки нет", async () => {
    const res = await stats("summary", "?date_from=2026-12-01&date_to=2026-01-01");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  test("ST-05 date_to учитывает операции в течение всего дня", async () => {
    const late = await createUser();
    const cat = await createCategory(late, "Поздно");
    await createOperation(late, { category_id: cat.category_id, kind: "expense", summ: 10, data: "2026-10-31T21:00:00Z" });
    const res = await get(`/api/stats/summary${OCTOBER}`, { token: late.token });
    expect(res.body.expense).toBe(10);
  });
});

describe("GET /api/stats/by-category", () => {
  test("ST-06 суммы сгруппированы по категориям", async () => {
    const res = await stats("by-category");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(
      expect.arrayContaining([
        { category_id: food.category_id, category_name: "Еда", income: 0, expense: 500.25 },
        { category_id: salary.category_id, category_name: "Зарплата", income: 1500, expense: 0 },
      ])
    );
  });

  test("ST-07 с фильтром по датам", async () => {
    const res = await stats("by-category", "?date_to=2026-09-30");
    expect(res.body).toEqual(
      expect.arrayContaining([
        { category_id: food.category_id, category_name: "Еда", income: 0, expense: 300 },
        { category_id: salary.category_id, category_name: "Зарплата", income: 1000, expense: 0 },
      ])
    );
    expect(res.body).toHaveLength(2);
  });
});

describe("GET /api/stats/timeline", () => {
  test("ST-08 суммы по месяцам в формате YYYY-MM, по возрастанию", async () => {
    const res = await stats("timeline");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { month: "2026-09", income: 1000, expense: 300 },
      { month: "2026-10", income: 500, expense: 200.25 },
    ]);
  });

  test("ST-09 с фильтром по датам", async () => {
    const res = await stats("timeline", OCTOBER);
    expect(res.body).toEqual([{ month: "2026-10", income: 500, expense: 200.25 }]);
  });
});

describe("Валидация дат во всех отчётах", () => {
  test.each(["summary", "by-category", "timeline"])("ST-10 %s: некорректная дата -> 400", async (path) => {
    const from = await stats(path, "?date_from=вчера");
    expect(from.status).toBe(400);
    expect(from.body.error).toBe("Некорректная дата в поле date_from");

    const to = await stats(path, "?date_to=2026-13-45");
    expect(to.status).toBe(400);
    expect(to.body.error).toBe("Некорректная дата в поле date_to");
  });
});
