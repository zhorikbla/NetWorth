/*
  Warnings:

  - A unique constraint covering the columns `[user_id,category_id,data]` on the table `limit` will be added. If there are existing duplicate values, this will fail.
  - Made the column `user_id` on table `category` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "category" DROP CONSTRAINT "category_user_id_fkey";

-- AlterTable
ALTER TABLE "category" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "limit" ALTER COLUMN "data" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "limit_user_id_category_id_data_key" ON "limit"("user_id", "category_id", "data");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
