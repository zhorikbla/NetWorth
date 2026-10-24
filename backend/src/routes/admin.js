const express = require("express");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const router = express.Router();

const VALID_ROLE_NAMES = ["user", "admin"];

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Получить список всех пользователей (только для admin)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 *       401:
 *         description: Пользователь не авторизован
 *       403:
 *         description: Доступ разрешён только администратору
 *       500:
 *         description: Ошибка сервера
 */

router.get("/users", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                nickname: true,
                email: true,
                role: { select: { role_name: true } },
            },
            orderBy: { user_id: "asc" },
        });

        res.json(
            users.map((user) => ({
                user_id: user.user_id,
                nickname: user.nickname,
                email: user.email,
                role: user.role.role_name,
            }))
        );
    } catch (error) {
        console.error("Admin get users failed:", error);
        res.status(500).json({
            error: "Не удалось получить список пользователей",
        });
    }
});

/**
 * @openapi
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Изменить роль пользователя (только для admin)
 *     tags:
 *       - Admin
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
 *             required:
 *               - role_name
 *             properties:
 *               role_name:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200:
 *         description: Роль изменена
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       403:
 *         description: Доступ разрешён только администратору
 *       404:
 *         description: Пользователь не найден
 *       500:
 *         description: Ошибка сервера
 */

router.patch("/users/:id/role", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID пользователя",
            });
        }

        const { role_name } = req.body;
        if (!VALID_ROLE_NAMES.includes(role_name)) {
            return res.status(400).json({
                error: "role_name должен быть user или admin",
            });
        }

        if (targetUserId === req.user.user_id) {
            return res.status(400).json({
                error: "Нельзя изменить собственную роль",
            });
        }

        const targetUser = await prisma.user.findUnique({
            where: { user_id: targetUserId },
        });
        if (!targetUser) {
            return res.status(404).json({
                error: "Пользователь не найден",
            });
        }

        const role = await prisma.role.findUnique({
            where: { role_name },
        });
        if (!role) {
            return res.status(500).json({
                error: `Системная роль ${role_name} не найдена`,
            });
        }

        const user = await prisma.user.update({
            where: { user_id: targetUserId },
            data: { role_id: role.role_id },
            select: {
                user_id: true,
                nickname: true,
                email: true,
                role: { select: { role_name: true } },
            },
        });

        res.json({
            user_id: user.user_id,
            nickname: user.nickname,
            email: user.email,
            role: user.role.role_name,
        });
    } catch (error) {
        console.error("Admin update role failed:", error);
        res.status(500).json({
            error: "Не удалось изменить роль пользователя",
        });
    }
});

/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Удалить пользователя (только для admin)
 *     tags:
 *       - Admin
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
 *         description: Пользователь удалён
 *       400:
 *         description: Некорректный ID или попытка удалить себя
 *       401:
 *         description: Пользователь не авторизован
 *       403:
 *         description: Доступ разрешён только администратору
 *       404:
 *         description: Пользователь не найден
 *       500:
 *         description: Ошибка сервера
 */

router.delete("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({
                error: "Некорректный ID пользователя",
            });
        }

        if (targetUserId === req.user.user_id) {
            return res.status(400).json({
                error: "Нельзя удалить самого себя через admin-эндпоинт — используйте DELETE /api/users/me",
            });
        }

        const targetUser = await prisma.user.findUnique({
            where: { user_id: targetUserId },
        });
        if (!targetUser) {
            return res.status(404).json({
                error: "Пользователь не найден",
            });
        }

        // Каскадное удаление (см. миграцию cascade_delete_user) уберёт
        // категории, операции и лимиты удаляемого пользователя.
        await prisma.user.delete({
            where: { user_id: targetUserId },
        });

        res.status(204).send();
    } catch (error) {
        console.error("Admin delete user failed:", error);
        res.status(500).json({
            error: "Не удалось удалить пользователя",
        });
    }
});

module.exports = router;
