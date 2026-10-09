// Единая точка подключения к базе данных через Prisma Client.
// Импортируйте prisma отсюда во всех остальных модулях,
// а не создавайте новый PrismaClient() в каждом файле.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
