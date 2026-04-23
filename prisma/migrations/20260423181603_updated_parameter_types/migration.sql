/*
  Warnings:

  - The `parameterTypes` column on the `Problem` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "parameterTypes",
ADD COLUMN     "parameterTypes" TEXT[];
