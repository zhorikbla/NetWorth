const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const jwt = require("jsonwebtoken");
const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - nickname
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: student@edu.mirea.ru
 *               nickname:
 *                 type: string
 *                 example: sanya_s1mple
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: Пользователь зарегистрирован
 *       400:
 *         description: Некорректные данные
 *       409:
 *         description: Email уже используется
 *       500:
 *         description: Ошибка сервера
 */

router.post("/register", async (req, res) =>{
    try{
        const { email, nickname, password } = req.body;

        if(typeof email !=="string" || typeof nickname !== "string" || typeof password!=="string") {
            return res.status(400).json({
                error: "Email, nickname и pasword обязательны"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedNickname = nickname.trim();

        if(!EMAIL_PATTERN.test(normalizedEmail)){
            return res.status(400).json({
                error: "Некорректный email",
            })
        }
        if(normalizedNickname.length<2){
            return res.status(400).json({
                error: "Nickname должен содержать минимум 2 символа",
            })
        }
        if(password.length<8){
            return res.status(400).json({
                error: "Пароль должен содержать минимум 8 символа",
            })
        }
        const existingUser = await prisma.user.findUnique({
            where:{
                email: normalizedEmail,
            },
        });
        if (existingUser){
            return res.status(409).json({
                error: "Пользователь с таким email уже существует",
            });
        }

        const userRole = await prisma.role.findUnique({
            where: {
                role_name: "user",
            },
        });
        if(!userRole){
            return res.status(500).json({
                error: "Системная роль user не найдена",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data:{
                email: normalizedEmail,
                nickname: normalizedNickname,
                password: passwordHash,
                role_id: userRole.role_id,
            },
            select:{
                user_id:true,
                email: true,
                nickname:true,
                role:{
                    select:{
                        role_name: true,
                    },
                },
            },
        });
        res.status(201).json(user);


    } catch (error){
        console.error("Register failed:", error);

        res.status(500).json({
            error: "Не удалось зарегистрировать пользователя",
        });
    }
});
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: nikita@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Успешный вход
 *       400:
 *         description: Email и пароль обязательны
 *       401:
 *         description: Неверный email или пароль
 *       500:
 *         description: Ошибка сервера
 */

router.post("/login", async(req,res)=>{
    try{
        const {email, password} = req.body;

        if (typeof email !=="string" || typeof password!=="string" || password.length ===0 ){
            return res.status(400).json({
                error: "Email и password должны быть не пустыми строками",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if(!EMAIL_PATTERN.test(normalizedEmail)){
            return res.status(400).json({
                error:"Некорректный email",
            });
        }
        const user = await prisma.user.findUnique({
            where:{
                email: normalizedEmail,
            },
            include : {
                role: true,
            },
        });

        if (!user){
            return res.status(401).json({
                error: "Неверный email или пароль",
            });
        }

        const passwordIsValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordIsValid){
            return res.status(401).json({
                error: "Неверный email или пароль",
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role.role_name,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1h",
            }
        );
        res.json({
            token,
            user:{
                user_id: user.user_id,
                nickname: user.nickname,
                email: user.email,
                role: user.role.role_name,
            },
        });
    
    
    } catch (error){
        console.error("Login failed:", error);
        res.status(500).json({
            error:"Не удалось выполнить вход",
        });
    }
});
module.exports = router;