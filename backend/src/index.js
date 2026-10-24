require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger")
const prisma = require("./db");
const cors = require("cors");

const categoriesRouter = require("./routes/categories");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const operationsRouter = require("./routes/operations");
const limitsRouter = require("./routes/limits");
const statsRouter = require("./routes/stats");
const adminRouter = require("./routes/admin");

const requiredEnvironmentVariables = ["DATABASE_URL", "JWT_SECRET"];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (variableName) => !process.env[variableName]
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Не заданы переменные окружения: ${missingEnvironmentVariables.join(", ")}`
  );
}

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// При раздельном деплое разрешаем запросы только с явно указанного frontend.
// Для единого Render-сервиса CORS не нужен, потому что frontend и API имеют один origin.
if (process.env.FRONTEND_URL) {
  app.use(cors({ origin: process.env.FRONTEND_URL }));
}

app.use("/api/categories", categoriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/operations", operationsRouter);
app.use("/api/limits", limitsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/admin", adminRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Проверка работы сервера
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Сервер работает
 */

app.get("/api/health", async (req, res) => {
  res.json({
    status: "ok",
    message: "NETWORTH backend is still alive"
  })
});

/**
 * @openapi
 * /api/db-check:
 *    get:
 *      summary: Проверка подключения к PostgreSQL
 *      tags:
 *        - System 
 *      responses:
 *       200: 
 *         description: Подключение к PostgreSQL успешно
 *       500: 
 *         description: Ошибка при подключении к PostgreSQL
*/
app.get("/api/db-check", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json(
      {
        status: "ok",
        database: "connected",
      }
    );
  } catch (error){
    console.error("Database check failed:", error);

    res.status(500).json(
      {
        status: "error",
        database: "disconnected",
      }
    );
  } 
});

// После `npm run build` Vite кладёт готовый frontend в frontend/dist.
// Express раздаёт эти файлы в production, а неизвестные frontend-маршруты
// возвращает в index.html, чтобы React Router обработал URL самостоятельно.
const frontendDistPath = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.use((req, res, next) => {
    const isFrontendRoute = req.method === "GET"
      && req.accepts("html")
      && !req.path.startsWith("/api");

    if (isFrontendRoute) {
      return res.sendFile(path.join(frontendDistPath, "index.html"));
    }

    next();
  });
}

app.use((req, res)=>{
  res.status(404).json({
    error:"Маршрут не найден",
  });
});

app.listen(PORT, () => {
  console.log(`NETWORTH API: http://localhost:${PORT}`);
  console.log(`SWAGGER UI: http://localhost:${PORT}/api-docs`);  
});
