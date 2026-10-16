const express = require("express");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

/**
 * @openapi
 * /api/limits:
 *   get:
 *     summary: Получить список лимитов текущего пользователя
 *     description: Для каждого лимита также возвращается, сколько уже потрачено по его категории за тот же период (поле spent) и остаток (поле remaining).
 *     tags:
 *       - Limits
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Список лимитов
 *       400:
 *         description: Некорректные параметры
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/", authMiddleware, async (req, res) => {
    try {
        const { category_id } = req.query;
        const where = { user_id: req.user.user_id };

        if (category_id !== undefined) {
            const categoryId = Number(category_id);
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return res.status(400).json({
                    error: "category_id должен быть положительным целым числом",
                });
            }
            where.category_id = categoryId;
        }

        const limits = await prisma.limit.findMany({
            where,
            orderBy: { data: "desc" },
        });

        // Лимит действует на месяц, начиная с поля data (см. ТЗ, п. 4.2).
        // Считаем, сколько потрачено по этой категории в том же месяце.
        const limitsWithUsage = await Promise.all(
            limits.map(async (limit) => {
                const periodStart = new Date(
                    Date.UTC(limit.data.getUTCFullYear(), limit.data.getUTCMonth(), 1)
                );
                const periodEnd = new Date(
                    Date.UTC(limit.data.getUTCFullYear(), limit.data.getUTCMonth() + 1, 1)
                );

                const spentResult = await prisma.operation.aggregate({
                    where: {
                        user_id: req.user.user_id,
                        category_id: limit.category_id,
                        kind: "expense",
                        data: { gte: periodStart, lt: periodEnd },
                    },
                    _sum: { summ: true },
                });

                const spent = spentResult._sum.summ || 0;

                return {
                    limit_id: limit.limit_id,
                    category_id: limit.category_id,
                    data: limit.data,
                    limit_summ: limit.limit_summ,
                    spent,
                    remaining: Number(limit.limit_summ) - Number(spent),
                };
            })
        );

        res.json(limitsWithUsage);
    } catch (error) {
        console.error("Get limits failed:", error);
        res.status(500).json({
            error: "Не удалось получить лимиты",
        });
    }
});

/**
 * @openapi
 * /api/limits:
 *   post:
 *     summary: Создать лимит на месяц для категории
 *     tags:
 *       - Limits
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - data
 *               - limit_summ
 *             properties:
 *               category_id:
 *                 type: integer
 *               data:
 *                 type: string
 *                 format: date
 *                 description: Любая дата внутри месяца, на который действует лимит
 *               limit_summ:
 *                 type: number
 *                 example: 15000
 *     responses:
 *       201:
 *         description: Лимит создан
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Категория не найдена
 *       409:
 *         description: Лимит для этой категории и месяца уже существует
 *       500:
 *         description: Ошибка сервера
 */

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { category_id, data, limit_summ } = req.body;
        const errors = [];

        const categoryId = Number(category_id);
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            errors.push("category_id должен быть положительным целым числом");
        }

        const limitSummNumber = Number(limit_summ);
        if (!Number.isFinite(limitSummNumber) || limitSummNumber <= 0) {
            errors.push("limit_summ должен быть положительным числом");
        }

        const limitDate = new Date(data);
        if (Number.isNaN(limitDate.getTime())) {
            errors.push("Некорректная дата в поле data");
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const category = await prisma.category.findFirst({
            where: { category_id: categoryId, user_id: req.user.user_id },
        });
        if (!category) {
            return res.status(404).json({
                error: "Категория не найдена",
            });
        }

        const limit = await prisma.limit.create({
            data: {
                category_id: categoryId,
                data: limitDate,
                limit_summ: limitSummNumber,
                user_id: req.user.user_id,
            },
        });

        res.status(201).json(limit);
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                error: "Лимит для этой категории и месяца уже существует",
            });
        }
        console.error("Create limit failed:", error);
        res.status(500).json({
            error: "Не удалось создать лимит",
        });
    }
});

/**
 * @openapi
 * /api/limits/{id}:
 *   patch:
 *     summary: Изменить лимит
 *     tags:
 *       - Limits
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 format: date
 *               limit_summ:
 *                 type: number
 *     responses:
 *       200:
 *         description: Лимит изменён
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Лимит не найден
 *       409:
 *         description: Лимит для этой категории и месяца уже существует
 *       500:
 *         description: Ошибка сервера
 */

router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const limitId = Number(req.params.id);
        if (!Number.isInteger(limitId) || limitId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID лимита",
            });
        }

        const existingLimit = await prisma.limit.findFirst({
            where: { limit_id: limitId, user_id: req.user.user_id },
        });
        if (!existingLimit) {
            return res.status(404).json({
                error: "Лимит не найден",
            });
        }

        const { data, limit_summ } = req.body;
        if (data === undefined && limit_summ === undefined) {
            return res.status(400).json({
                error: "Нечего изменять — передайте data или limit_summ",
            });
        }

        const errors = [];
        const updateData = {};

        if (data !== undefined) {
            const limitDate = new Date(data);
            if (Number.isNaN(limitDate.getTime())) {
                errors.push("Некорректная дата в поле data");
            } else {
                updateData.data = limitDate;
            }
        }

        if (limit_summ !== undefined) {
            const limitSummNumber = Number(limit_summ);
            if (!Number.isFinite(limitSummNumber) || limitSummNumber <= 0) {
                errors.push("limit_summ должен быть положительным числом");
            } else {
                updateData.limit_summ = limitSummNumber;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const limit = await prisma.limit.update({
            where: { limit_id: limitId },
            data: updateData,
        });

        res.json(limit);
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                error: "Лимит для этой категории и месяца уже существует",
            });
        }
        console.error("Update limit failed:", error);
        res.status(500).json({
            error: "Не удалось изменить лимит",
        });
    }
});

/**
 * @openapi
 * /api/limits/{id}:
 *   delete:
 *     summary: Удалить лимит
 *     tags:
 *       - Limits
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Лимит удалён
 *       400:
 *         description: Некорректный ID
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Лимит не найден
 *       500:
 *         description: Ошибка сервера
 */

router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const limitId = Number(req.params.id);
        if (!Number.isInteger(limitId) || limitId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID лимита",
            });
        }

        const limit = await prisma.limit.findFirst({
            where: { limit_id: limitId, user_id: req.user.user_id },
        });
        if (!limit) {
            return res.status(404).json({
                error: "Лимит не найден",
            });
        }

        await prisma.limit.delete({ where: { limit_id: limitId } });

        res.status(204).send();
    } catch (error) {
        console.error("Delete limit failed:", error);
        res.status(500).json({
            error: "Не удалось удалить лимит",
        });
    }
});

module.exports = router;
