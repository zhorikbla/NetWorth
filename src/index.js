// Точка входа сервера. Задача этого этапа — подтвердить,
// что подключение к БД работает: /health опрашивает Postgres через Prisma.

require("dotenv").config();
const express = require("express");
const prisma = require("./db");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Проверка, что сервер и БД живы.
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("DB health check failed:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Временный эндпоинт, чтобы визуально проверить тестовые данные.
// Уберите или замените реальными роутами, когда дойдёте до недели 2.
app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
  });
  res.json(users);
});

app.listen(PORT, () => {
  console.log(`NETWORTH backend listening on http://localhost:${PORT}`);
});
