require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger")
const prisma = require("./db");

const categoriesRouter = require("./routes/categories");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const operationsRouter = require("./routes/operations");
const limitsRouter = require("./routes/limits");
const statsRouter = require("./routes/stats");
const adminRouter = require("./routes/admin");

const cors = require("cors"); //Для render

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.use(cors({ origin: process.env.FRONTEND_URL })); //Для Render

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

app.use((req, res)=>{
  res.status(404).json({
    error:"Маршрут не найден",
  });
});

app.listen(PORT, () => {
  console.log(`NETWORTH API: http://localhost:${PORT}`);
  console.log(`SWAGGER UI: http://localhost:${PORT}/api-docs`);  
});



