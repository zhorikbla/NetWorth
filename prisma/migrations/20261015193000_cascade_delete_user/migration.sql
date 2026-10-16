-- При удалении пользователя (DELETE /api/users/me) должны автоматически
-- удаляться его категории, операции и лимиты — иначе внешние ключи
-- не дадут удалить саму запись user.

-- DropForeignKey
ALTER TABLE "category" DROP CONSTRAINT "category_user_id_fkey";
ALTER TABLE "operation" DROP CONSTRAINT "operation_user_id_fkey";
ALTER TABLE "limit" DROP CONSTRAINT "limit_user_id_fkey";

-- AddForeignKey (с ON DELETE CASCADE)
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operation" ADD CONSTRAINT "operation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "limit" ADD CONSTRAINT "limit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
