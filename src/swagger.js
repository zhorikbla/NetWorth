const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
    definition : {
        openapi: "3.0.3",
        info: {
            title: "NETWORTH API",
            version: "1.0.0",
            description:"REST API приложения для учета личных финансов",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description:"Локальный сервер",
            },
        ],
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
        path.join(__dirname, "routes", "*.js"),
    ],
});

module.exports = swaggerSpec;
