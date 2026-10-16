const express = require("express");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Получить список категорий
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список категорий
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */

router.get("/", authMiddleware, async (req,res)=>{
    try{
        const categories = await prisma.category.findMany({
            select:{
                category_id: true,
                name: true,
                user_id: true,
            },
            orderBy:{
                category_id:"asc",
            },
        });

        res.json(categories);
    } catch(error){
        console.error("Get categories failed: ", error);
        res.status(500).json({
            error: "Не удалось получить категории",
        });
    }
});


/**
 * @openapi
 * /api/categories:
 *   post:
 *     summary: Создать категорию
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Развлечения
 *     responses:
 *       201:
 *         description: Категория создана
 *       400:
 *         description: Некорректное название
 *       401:
 *         description: Пользователь не авторизован
 *       500:
 *         description: Ошибка сервера
 */



router.post("/", authMiddleware, async (req, res)=>{
    try{
        const { name } = req.body;

        if(typeof name !== "string" || name.trim().length<2){
            return res.status(400).json({
                error: "Название категори должно содержать минимум 2 символа",
            });
        }
        const category = await prisma.category.create({
            data:{
                name: name.trim(),
                user_id: req.user.user_id,
            },
            select: {
                category_id: true,
                name: true,
            },
        });
        res.status(201).json(category);
    } catch(error){
        console.error("Create category failed:", error);

        res.status(500).json({
            error: "Не удалось создать категорию",
        });
    }
});

/**
 * @openapi
 * /api/categories/{id}:
 *   patch:
 *     summary: Изменить категорию
 *     tags:
 *       - Categories
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
 *               name:
 *                 type: string
 *                 example: Отдых и развлечения
 *     responses:
 *       200:
 *         description: Категория изменена
 *       400:
 *         description: Некорректные данные
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Ошибка сервера
 */

router.patch("/:id", authMiddleware, async (req, res)=> {
    try{
        const categoryId = Number(req.params.id);
        const { name } = req.body;

        if(!Number.isInteger(categoryId) || categoryId<=0){
            return res.status(400).json({
                error : "Некорректный ID категории",
            });
        }
        if (name === undefined){
            return res.status(400).json({
                error: "Нечего изменять — передайте поле name",
            });
        }
        if (typeof name !=="string" || name.trim().length<2){
            return res.status(400).json({
                error: "Название категории должно содержать минимум 2 символа",
            });
        }
        const existingCategory = await prisma.category.findFirst({
            where: {
                category_id: categoryId,
                user_id: req.user.user_id,
            },
        });
        if (!existingCategory){
            return res.status(404).json({
                error: "Категория не найдена",
            });
        }
        const category = await prisma.category.update({
            where:{
                category_id: categoryId,
            },
            data: {
                name: name.trim(),
            },
            select: {
                category_id: true,
                name: true,
            },
        });

        res.json(category);
    } catch(error){
        console.error("Update category failed:", error);
        res.status(500).json({
            error: "Не удалось изменить категорию",
        });
    }

});

/**
 * 
 * @openapi
 * /api/categories/{id}:
 *   delete:
 *     summary: Удалить категорию
 *     tags:
 *       - Categories
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
 *         description: Категория удалена
 *       400:
 *         description: Некорректный ID
 *       401:
 *         description: Пользователь не авторизован
 *       404:
 *         description: Категория не найдена
 *       409:
 *         description: Категория используется
 *       500:
 *         description: Ошибка сервера
 */

router.delete("/:id", authMiddleware, async(req,res)=>{
    try{
        const categoryId = Number(req.params.id);
        if (!Number.isInteger(categoryId) || categoryId <= 0){
            return res.status(400).json({
                error: "Некорректный Id категории",
            });
        }

        const category = await prisma.category.findFirst({
            where:{
                category_id: categoryId,
                user_id: req.user.user_id,
            },
            include: {
                _count: {
                    select: {
                        operations: true,
                        limits: true,
                    },
                },
            },
        });

        if (!category){
            return res.status(404). json({
                error: "Категория не найдена",
            });
        }
        if (category._count.operations>0 || category._count.limits>0){
            return res.status(409).json({
                error:"Нельзя удалить категорию, пока с ней связаны операции и лимиты",
            });
        }
        await prisma.category.delete({
            where:{
                category_id: categoryId,
            },
        });

        res.status(204).send();
    } catch(error){
        console.error("Delete category failed:", error);

        return res.status(500).json({
            error: "Не удалось удалить категорию",
        });
    }
});
module.exports = router;