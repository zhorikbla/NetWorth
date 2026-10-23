// Подключается к каждому тестовому файлу: после его тестов закрывает пул соединений.
import { afterAll } from "vitest";
import { closeDb } from "../helpers/db.js";

afterAll(async () => {
  await closeDb();
});
