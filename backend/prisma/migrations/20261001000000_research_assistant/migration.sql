-- Prepared migration only. Deployment is an explicit operator action.
CREATE TYPE "OpportunityStatus" AS ENUM ('draft', 'open', 'closed');
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'completed');
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

CREATE TABLE "research_opportunities" (
  "id" UUID NOT NULL,
  "core_user_id" TEXT NOT NULL,
  "research_title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "responsibilities" TEXT NOT NULL,
  "positions" INTEGER NOT NULL,
  "required_skills" TEXT[] NOT NULL,
  "start_date" TIMESTAMPTZ(3) NOT NULL,
  "end_date" TIMESTAMPTZ(3) NOT NULL,
  "application_deadline" TIMESTAMPTZ(3) NOT NULL,
  "faculty" TEXT NOT NULL,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_opportunities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "opportunity_positions_positive" CHECK ("positions" > 0),
  CONSTRAINT "opportunity_dates_valid" CHECK ("end_date" >= "start_date" AND "application_deadline" <= "start_date")
);
CREATE TABLE "research_applications" (
  "id" UUID NOT NULL,
  "research_opportunity_id" UUID NOT NULL,
  "core_user_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL,
  "experience" TEXT,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_applications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "research_assistants" (
  "id" UUID NOT NULL,
  "research_opportunity_id" UUID NOT NULL,
  "research_application_id" UUID NOT NULL,
  "core_user_id" TEXT NOT NULL,
  "responsibilities" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_assistants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "research_tasks" (
  "id" UUID NOT NULL,
  "research_assistant_id" UUID NOT NULL,
  "task_title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "due_date" TIMESTAMPTZ(3) NOT NULL,
  "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
  "status" "TaskStatus" NOT NULL DEFAULT 'todo',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_tasks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "progress_reports" (
  "id" UUID NOT NULL,
  "research_task_id" UUID NOT NULL,
  "core_user_id" TEXT NOT NULL,
  "progress_percentage" INTEGER NOT NULL,
  "progress_detail" TEXT NOT NULL,
  "problems" TEXT,
  "next_action" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "progress_percentage_range" CHECK ("progress_percentage" BETWEEN 0 AND 100)
);
CREATE TABLE "research_evaluations" (
  "id" UUID NOT NULL,
  "research_assistant_id" UUID NOT NULL,
  "core_user_id" TEXT NOT NULL,
  "responsibility_score" INTEGER NOT NULL,
  "quality_score" INTEGER NOT NULL,
  "punctuality_score" INTEGER NOT NULL,
  "teamwork_score" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "research_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evaluation_score_range" CHECK (
    "responsibility_score" BETWEEN 1 AND 5 AND "quality_score" BETWEEN 1 AND 5
    AND "punctuality_score" BETWEEN 1 AND 5 AND "teamwork_score" BETWEEN 1 AND 5
  )
);
CREATE INDEX "research_opportunities_core_user_id_idx" ON "research_opportunities"("core_user_id");
CREATE INDEX "research_opportunities_status_application_deadline_idx" ON "research_opportunities"("status", "application_deadline");
CREATE UNIQUE INDEX "research_applications_research_opportunity_id_core_user_id_key" ON "research_applications"("research_opportunity_id", "core_user_id");
CREATE INDEX "research_applications_core_user_id_idx" ON "research_applications"("core_user_id");
CREATE UNIQUE INDEX "research_assistants_research_application_id_key" ON "research_assistants"("research_application_id");
CREATE UNIQUE INDEX "research_assistants_research_opportunity_id_core_user_id_key" ON "research_assistants"("research_opportunity_id", "core_user_id");
CREATE INDEX "research_assistants_core_user_id_idx" ON "research_assistants"("core_user_id");
CREATE INDEX "research_tasks_research_assistant_id_idx" ON "research_tasks"("research_assistant_id");
CREATE INDEX "progress_reports_research_task_id_created_at_idx" ON "progress_reports"("research_task_id", "created_at");
CREATE INDEX "research_evaluations_research_assistant_id_idx" ON "research_evaluations"("research_assistant_id");
ALTER TABLE "research_applications" ADD CONSTRAINT "research_applications_research_opportunity_id_fkey" FOREIGN KEY ("research_opportunity_id") REFERENCES "research_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "research_assistants" ADD CONSTRAINT "research_assistants_research_opportunity_id_fkey" FOREIGN KEY ("research_opportunity_id") REFERENCES "research_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "research_assistants" ADD CONSTRAINT "research_assistants_research_application_id_fkey" FOREIGN KEY ("research_application_id") REFERENCES "research_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_research_assistant_id_fkey" FOREIGN KEY ("research_assistant_id") REFERENCES "research_assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_research_task_id_fkey" FOREIGN KEY ("research_task_id") REFERENCES "research_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "research_evaluations" ADD CONSTRAINT "research_evaluations_research_assistant_id_fkey" FOREIGN KEY ("research_assistant_id") REFERENCES "research_assistants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
