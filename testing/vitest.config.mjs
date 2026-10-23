import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    // Перед всеми тестами: пересоздать тестовую БД, применить миграции, поднять сервер.
    globalSetup: ["tests/setup/global-setup.js"],
    // В каждом файле: закрыть соединение с БД после тестов.
    setupFiles: ["tests/setup/per-file.js"],
    // Все файлы работают с одним сервером и одной БД, поэтому по очереди.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 60000,
    reporters: ["verbose"],
  },
});
