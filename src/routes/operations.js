const express = require("express");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

const OPERATION_KINDS = ["income", "expense"];

function parseDate(value, fieldName, errors) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        errors.push(`Некорректная дата в поле ${fieldName}`);
        return null;
    }
    return date;
}

/**
 * @openapi
 * /api/operations:
 *   get:
 *     summary: Получить список операций текущего пользователя
 *     tags:
 *       - Operations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Список операций
 *       400:
 *         description: Некорректные параметры фильтра
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/", authMiddleware, async (req, res) => {
    try {
        const { kind, category_id, date_from, date_to } = req.query;
        const errors = [];
        const where = { user_id: req.user.user_id };

        if (kind !== undefined) {
            if (!OPERATION_KINDS.includes(kind)) {
                errors.push("kind должен быть income или expense");
            } else {
                where.kind = kind;
            }
        }

        if (category_id !== undefined) {
            const categoryId = Number(category_id);
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                errors.push("category_id должен быть положительным целым числом");
            } else {
                where.category_id = categoryId;
            }
        }

        if (date_from !== undefined || date_to !== undefined) {
            where.data = {};
            if (date_from !== undefined) {
                const from = parseDate(date_from, "date_from", errors);
                if (from) where.data.gte = from;
            }
            if (date_to !== undefined) {
                const to = parseDate(date_to, "date_to", errors);
                if (to) where.data.lte = to;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const operations = await prisma.operation.findMany({
            where,
            orderBy: { data: "desc" },
            select: {
                operation_id: true,
                summ: true,
                data: true,
                kind: true,
                comment: true,
                category_id: true,
            },
        });

        res.json(operations);
    } catch (error) {
        console.error("Get operations failed:", error);
        res.status(500).json({
            error: "Не удалось получить операции",
        });
    }
});

/**
 * @openapi
 * /api/operations/{id}:
 *   get:
 *     summary: Получить операцию по ID
 *     tags:
 *       - Operations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Операция найдена
 *       400:
 *         description: Некорректный ID
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Операция не найдена
 *       500:
 *         description: Ошибка сервера
 */

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const operationId = Number(req.params.id);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID операции",
            });
        }

        const operation = await prisma.operation.findFirst({
            where: {
                operation_id: operationId,
                user_id: req.user.user_id,
            },
            select: {
                operation_id: true,
                summ: true,
                data: true,
                kind: true,
                comment: true,
                category_id: true,
            },
        });

        if (!operation) {
            return res.status(404).json({
                error: "Операция не найдена",
            });
        }

        res.json(operation);
    } catch (error) {
        console.error("Get operation failed:", error);
        res.status(500).json({
            error: "Не удалось получить операцию",
        });
    }
});

/**
 * @openapi
 * /api/operations:
 *   post:
 *     summary: Создать операцию
 *     tags:
 *       - Operations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - summ
 *               - kind
 *               - category_id
 *             properties:
 *               summ:
 *                 type: number
 *                 example: 350.5
 *               kind:
 *                 type: string
 *                 enum: [income, expense]
 *               data:
 *                 type: string
 *                 format: date
 *               comment:
 *                 type: string
 *               category_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Операция создана
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Ошибка сервера
 */

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { summ, kind, data, comment, category_id } = req.body;
        const errors = [];

        const summNumber = Number(summ);
        if (!Number.isFinite(summNumber) || summNumber <= 0) {
            errors.push("summ должен быть положительным числом");
        }

        if (!OPERATION_KINDS.includes(kind)) {
            errors.push("kind должен быть income или expense");
        }

        const categoryId = Number(category_id);
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            errors.push("category_id должен быть положительным целым числом");
        }

        let operationDate = new Date();
        if (data !== undefined) {
            operationDate = parseDate(data, "data", errors);
        }

        if (comment !== undefined && typeof comment !== "string") {
            errors.push("comment должен быть строкой");
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const category = await prisma.category.findFirst({
            where: {
                category_id: categoryId,
                user_id: req.user.user_id,
            },
        });
        if (!category) {
            return res.status(404).json({
                error: "Категория не найдена",
            });
        }

        const operation = await prisma.operation.create({
            data: {
                summ: summNumber,
                kind,
                data: operationDate,
                comment: comment !== undefined ? comment.trim() : undefined,
                user_id: req.user.user_id,
                category_id: categoryId,
            },
            select: {
                operation_id: true,
                summ: true,
                data: true,
                kind: true,
                comment: true,
                category_id: true,
            },
        });

        res.status(201).json(operation);
    } catch (error) {
        console.error("Create operation failed:", error);
        res.status(500).json({
            error: "Не удалось создать операцию",
        });
    }
});

/**
 * @openapi
 * /api/operations/{id}:
 *   patch:
 *     summary: Изменить операцию
 *     tags:
 *       - Operations
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
 *               summ:
 *                 type: number
 *               kind:
 *                 type: string
 *                 enum: [income, expense]
 *               data:
 *                 type: string
 *                 format: date
 *               comment:
 *                 type: string
 *               category_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Операция изменена
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Операция или категория не найдена
 *       500:
 *         description: Ошибка сервера
 */

router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const operationId = Number(req.params.id);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID операции",
            });
        }

        const existingOperation = await prisma.operation.findFirst({
            where: {
                operation_id: operationId,
                user_id: req.user.user_id,
            },
        });
        if (!existingOperation) {
            return res.status(404).json({
                error: "Операция не найдена",
            });
        }

        const { summ, kind, data, comment, category_id } = req.body;
        const errors = [];
        const updateData = {};

        if (summ !== undefined) {
            const summNumber = Number(summ);
            if (!Number.isFinite(summNumber) || summNumber <= 0) {
                errors.push("summ должен быть положительным числом");
            } else {
                updateData.summ = summNumber;
            }
        }

        if (kind !== undefined) {
            if (!OPERATION_KINDS.includes(kind)) {
                errors.push("kind должен быть income или expense");
            } else {
                updateData.kind = kind;
            }
        }

        if (data !== undefined) {
            const operationDate = parseDate(data, "data", errors);
            if (operationDate) updateData.data = operationDate;
        }

        if (comment !== undefined) {
            if (typeof comment !== "string") {
                errors.push("comment должен быть строкой");
            } else {
                updateData.comment = comment.trim();
            }
        }

        let categoryId;
        if (category_id !== undefined) {
            categoryId = Number(category_id);
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                errors.push("category_id должен быть положительным целым числом");
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        if (categoryId !== undefined) {
            const category = await prisma.category.findFirst({
                where: {
                    category_id: categoryId,
                    user_id: req.user.user_id,
                },
            });
            if (!category) {
                return res.status(404).json({
                    error: "Категория не найдена",
                });
            }
            updateData.category_id = categoryId;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: "Нечего изменять",
            });
        }

        const operation = await prisma.operation.update({
            where: { operation_id: operationId },
            data: updateData,
            select: {
                operation_id: true,
                summ: true,
                data: true,
                kind: true,
                comment: true,
                category_id: true,
            },
        });

        res.json(operation);
    } catch (error) {
        console.error("Update operation failed:", error);
        res.status(500).json({
            error: "Не удалось изменить операцию",
        });
    }
});

/**
 * @openapi
 * /api/operations/{id}:
 *   delete:
 *     summary: Удалить операцию
 *     tags:
 *       - Operations
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
 *         description: Операция удалена
 *       400:
 *         description: Некорректный ID
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Операция не найдена
 *       500:
 *         description: Ошибка сервера
 */

router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const operationId = Number(req.params.id);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID операции",
            });
        }

        const operation = await prisma.operation.findFirst({
            where: {
                operation_id: operationId,
                user_id: req.user.user_id,
            },
        });
        if (!operation) {
            return res.status(404).json({
                error: "Операция не найдена",
            });
        }

        await prisma.operation.delete({
            where: { operation_id: operationId },
        });

        res.status(204).send();
    } catch (error) {
        console.error("Delete operation failed:", error);
        res.status(500).json({
            error: "Не удалось удалить операцию",
        });
    }
});

module.exports = router;
