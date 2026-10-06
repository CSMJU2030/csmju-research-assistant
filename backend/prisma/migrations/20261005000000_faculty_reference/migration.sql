-- Preserve existing records. Only rename the reference column and migrate the retired Core code.
ALTER TABLE "research_opportunities" RENAME COLUMN "faculty" TO "faculty_code";
UPDATE "research_opportunities" SET "faculty_code" = 'SCI' WHERE "faculty_code" = 'science';
