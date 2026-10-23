// Сид тестовыми данными для NETWORTH.
// Role: 2 записи (user/admin) — по ТЗ для неё 3 тестовых объекта не нужны.
// User, Category, Operation, Limit: по 3 тестовые записи на каждую сущность.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // 1. Роли (ровно 2, не тестовые данные, а системный справочник)
  const roleUser = await prisma.role.upsert({
    where: { role_name: "user" },
    update: {},
    create: { role_name: "user" },
  });
  const roleAdmin = await prisma.role.upsert({
    where: { role_name: "admin" },
    update: {},
    create: { role_name: "admin" },
  });

  // 2. Пользователи (3 тестовые записи)
  const user1PasswordHash = await bcrypt.hash("password123", 10);
  const user2PasswordHash = await bcrypt.hash("password123", 10);
  const adminPasswordHash = await bcrypt.hash("password123", 10);

  const user1 = await prisma.user.upsert({
    where: { email: "nikita@example.com" },
    update: {},
    create: {
      nickname: "nikita",
      email: "nikita@example.com",
      password: user1PasswordHash,
      role_id: roleUser.role_id,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "olga@example.com" },
    update: {},
    create: {
      nickname: "olga",
      email: "olga@example.com",
      password: user2PasswordHash,
      role_id: roleUser.role_id,
    },
  });

  const admin1 = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      nickname: "admin",
      email: "admin@example.com",
      password: adminPasswordHash,
      role_id: roleAdmin.role_id,
    },
  });

  // 3. Категории (3 тестовые записи)
  const catTransport = await prisma.category.create({
    data: { name: "Транспорт", user_id: user1.user_id },
  });
  const catFood = await prisma.category.create({
    data: { name: "Еда", user_id: user1.user_id },
  });
  const catSalary = await prisma.category.create({
    data: { name: "Зарплата", user_id: user2.user_id },
  });

  // 4. Операции (3 тестовые записи)
  await prisma.operation.create({
    data: {
      summ: 350.5,
      data: new Date("2026-10-01"),
      kind: "expense",
      comment: "Проезд на метро",
      user_id: user1.user_id,
      category_id: catTransport.category_id,
    },
  });
  await prisma.operation.create({
    data: {
      summ: 1200,
      data: new Date("2026-10-03"),
      kind: "expense",
      comment: "Продукты на неделю",
      user_id: user1.user_id,
      category_id: catFood.category_id,
    },
  });
  await prisma.operation.create({
    data: {
      summ: 80000,
      data: new Date("2026-10-05"),
      kind: "income",
      comment: "Зарплата за октябрь",
      user_id: user2.user_id,
      category_id: catSalary.category_id,
    },
  });

  // 5. Лимиты (3 тестовые записи)
  await prisma.limit.create({
    data: {
      data: new Date("2026-10-01"),
      limit_summ: 5000,
      user_id: user1.user_id,
      category_id: catTransport.category_id,
    },
  });

  await prisma.limit.create({
    data: {
      data: new Date("2026-10-01"),
      limit_summ: 15000,
      user_id: user1.user_id,
      category_id: catFood.category_id,
    },
  });

  await prisma.limit.create({
    data: {
      data: new Date("2026-11-01"),
      limit_summ: 6000,
      user_id: user1.user_id,
      category_id: catTransport.category_id,
    },
  });

  console.log("Сид выполнен успешно:");
  console.log("- Роли: 2 (user, admin)");
  console.log("- Пользователи: 3");
  console.log("- Категории: 3");
  console.log("- Операции: 3");
  console.log("- Лимиты: 3");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
