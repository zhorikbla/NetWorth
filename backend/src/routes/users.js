const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Получить профиль текущего пользователя
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Профиль пользователя
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Пользователь не найден
 *       500:
 *         description: Ошибка сервера
 */

router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                user_id: req.user.user_id,
            },
            select: {
                user_id: true,
                nickname: true,
                email: true,
                role: {
                    select: {
                        role_name: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({
                error: "Пользователь не найден",
            });
        }

        res.json({
            user_id: user.user_id,
            nickname: user.nickname,
            email: user.email,
            role: user.role.role_name,
        });
    } catch (error) {
        console.error("Get profile failed:", error);
        res.status(500).json({
            error: "Не удалось получить профиль",
        });
    }
});

/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     summary: Изменить данные профиля текущего пользователя
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 example: sanya_s1mple
 *               email:
 *                 type: string
 *                 example: new-email@example.com
 *               password:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Профиль изменён
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       409:
 *         description: Email уже используется
 *       500:
 *         description: Ошибка сервера
 */

router.patch("/me", authMiddleware, async (req, res) => {
    try {
        const { nickname, email, password } = req.body;

        if (nickname === undefined && email === undefined && password === undefined) {
            return res.status(400).json({
                error: "Нечего изменять — передайте nickname, email или password",
            });
        }

        const data = {};

        if (nickname !== undefined) {
            const normalizedNickname = String(nickname).trim();
            if (normalizedNickname.length < 2) {
                return res.status(400).json({
                    error: "Nickname должен содержать минимум 2 символа",
                });
            }
            data.nickname = normalizedNickname;
        }

        if (email !== undefined) {
            const normalizedEmail = String(email).trim().toLowerCase();
            if (!normalizedEmail.includes("@")) {
                return res.status(400).json({
                    error: "Некорректный email",
                });
            }

            const existingUser = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });
            if (existingUser && existingUser.user_id !== req.user.user_id) {
                return res.status(409).json({
                    error: "Пользователь с таким email уже существует",
                });
            }

            data.email = normalizedEmail;
        }

        if (password !== undefined) {
            if (typeof password !== "string" || password.length < 8) {
                return res.status(400).json({
                    error: "Пароль должен содержать минимум 8 символов",
                });
            }
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { user_id: req.user.user_id },
            data,
            select: {
                user_id: true,
                nickname: true,
                email: true,
                role: {
                    select: { role_name: true },
                },
            },
        });

        res.json({
            user_id: user.user_id,
            nickname: user.nickname,
            email: user.email,
            role: user.role.role_name,
        });
    } catch (error) {
        console.error("Update profile failed:", error);
        res.status(500).json({
            error: "Не удалось изменить профиль",
        });
    }
});

/**
 * @openapi
 * /api/users/me:
 *   delete:
 *     summary: Удалить свой аккаунт
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Аккаунт удалён
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.delete("/me", authMiddleware, async (req, res) => {
    try {
        // Каскадное удаление (см. миграцию cascade_delete_user) само уберёт
        // категории, операции и лимиты этого пользователя.
        await prisma.user.delete({
            where: { user_id: req.user.user_id },
        });

        res.status(204).send();
    } catch (error) {
        console.error("Delete account failed:", error);
        res.status(500).json({
            error: "Не удалось удалить аккаунт",
        });
    }
});

module.exports = router;
