// Прямой доступ к тестовой БД: проверить, что API действительно записал или удалил данные.
import pg from "pg";
import { TEST_DATABASE_URL } from "../setup/config.js";

let pool;

function getPool() {
  pool ??= new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 });
  return pool;
}

export async function query(sql, params = []) {
  return (await getPool().query(sql, params)).rows;
}

// Отдельный клиент для тестов БД, которые работают внутри транзакции.
export async function connectClient() {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
