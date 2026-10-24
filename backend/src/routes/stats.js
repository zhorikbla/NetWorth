const express = require("express");
const { Prisma } = require("@prisma/client");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

function parseDate(value, fieldName, errors) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        errors.push(`Некорректная дата в поле ${fieldName}`);
        return null;
    }
    return date;
}

function parseEndDate(value, fieldName, errors){
    const date = parseDate(value, fieldName, errors);
    if(!date){
        return null;
    }
    date.setUTCDate(date.getUTCDate()+1);
    return date;
}

function buildDateWhere(date_from, date_to, errors) {
    const where = {};
    if (date_from !== undefined) {
        const from = parseDate(date_from, "date_from", errors);
        if (from) where.gte = from;
    }
    if (date_to !== undefined) {
        const to = parseEndDate(date_to, "date_to", errors);
        if (to) where.lt = to;
    }
    return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * @openapi
 * /api/stats/summary:
 *   get:
 *     summary: Доходы, расходы и остаток за период
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Сводка income/expense/balance
 *       400:
 *         description: Некорректные параметры
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/summary", authMiddleware, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const errors = [];
        const dataWhere = buildDateWhere(date_from, date_to, errors);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const where = { user_id: req.user.user_id };
        if (dataWhere) where.data = dataWhere;

        const [incomeResult, expenseResult] = await Promise.all([
            prisma.operation.aggregate({
                where: { ...where, kind: "income" },
                _sum: { summ: true },
            }),
            prisma.operation.aggregate({
                where: { ...where, kind: "expense" },
                _sum: { summ: true },
            }),
        ]);

        const income = Number(incomeResult._sum.summ || 0);
        const expense = Number(expenseResult._sum.summ || 0);

        res.json({
            income,
            expense,
            balance: income - expense,
        });
    } catch (error) {
        console.error("Get stats summary failed:", error);
        res.status(500).json({
            error: "Не удалось получить сводную статистику",
        });
    }
});

/**
 * @openapi
 * /api/stats/by-category:
 *   get:
 *     summary: Доходы и расходы, сгруппированные по категориям
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Список категорий с суммами income/expense
 *       400:
 *         description: Некорректные параметры
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/by-category", authMiddleware, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const errors = [];
        const dataWhere = buildDateWhere(date_from, date_to, errors);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const where = { user_id: req.user.user_id };
        if (dataWhere) where.data = dataWhere;

        const grouped = await prisma.operation.groupBy({
            by: ["category_id", "kind"],
            where,
            _sum: { summ: true },
        });

        const categoryIds = [...new Set(grouped.map((row) => row.category_id))];
        const categories = await prisma.category.findMany({
            where: { category_id: { in: categoryIds } },
            select: { category_id: true, name: true },
        });
        const categoryNameById = new Map(
            categories.map((category) => [category.category_id, category.name])
        );

        const byCategory = new Map();
        for (const row of grouped) {
            if (!byCategory.has(row.category_id)) {
                byCategory.set(row.category_id, {
                    category_id: row.category_id,
                    category_name: categoryNameById.get(row.category_id) || null,
                    income: 0,
                    expense: 0,
                });
            }
            const entry = byCategory.get(row.category_id);
            entry[row.kind] = Number(row._sum.summ || 0);
        }

        res.json([...byCategory.values()]);
    } catch (error) {
        console.error("Get stats by category failed:", error);
        res.status(500).json({
            error: "Не удалось получить статистику по категориям",
        });
    }
});

/**
 * @openapi
 * /api/stats/timeline:
 *   get:
 *     summary: Доходы и расходы по месяцам
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Массив { month, income, expense }, отсортированный по месяцу
 *       400:
 *         description: Некорректные параметры
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/timeline", authMiddleware, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const errors = [];
        const from = date_from !== undefined ? parseDate(date_from, "date_from", errors) : null;
        const to = date_to !== undefined ? parseEndDate(date_to, "date_to", errors) : null;
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const conditions = [Prisma.sql`user_id = ${req.user.user_id}`];
        if (from) conditions.push(Prisma.sql`data >= ${from}`);
        if (to) conditions.push(Prisma.sql`data < ${to}`);
        const whereClause = Prisma.join(conditions, " AND ");

        const rows = await prisma.$queryRaw`
            SELECT
                date_trunc('month', data) AS month,
                SUM(CASE WHEN kind = 'income' THEN summ ELSE 0 END) AS income,
                SUM(CASE WHEN kind = 'expense' THEN summ ELSE 0 END) AS expense
            FROM "operation"
            WHERE ${whereClause}
            GROUP BY month
            ORDER BY month ASC
        `;

        const timeline = rows.map((row) => ({
            month: row.month.toISOString().slice(0, 7), // "YYYY-MM"
            income: Number(row.income),
            expense: Number(row.expense),
        }));

        res.json(timeline);
    } catch (error) {
        console.error("Get stats timeline failed:", error);
        res.status(500).json({
            error: "Не удалось получить статистику по месяцам",
        });
    }
});

module.exports = router;
