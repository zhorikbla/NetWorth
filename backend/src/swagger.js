const fs = require("fs");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const routesDir = path.join(__dirname, "routes");

// Не используем маску "*.js" напрямую в apis — на Windows path.join
// собирает путь с обратными слэшами, а glob-резолвер swagger-jsdoc
// трактует "\" как экранирующий символ и не находит файлы.
// Поэтому просто читаем список файлов сами и передаём литеральные пути.
const routeFiles = fs
    .readdirSync(routesDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.join(routesDir, file));

const swaggerSpec = swaggerJsdoc({
    definition : {
        openapi: "3.0.3",
        info: {
            title: "NETWORTH API",
            version: "1.0.0",
            description:"REST API приложения для учета личных финансов",
        },
        servers: [{ url: "/", description: "Текущий сервер" }],
        components:{
            securitySchemes:{
                bearerAuth:{
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: [
        path.join(__dirname, "index.js"),
        ...routeFiles,
    ],
});

module.exports = swaggerSpec;
