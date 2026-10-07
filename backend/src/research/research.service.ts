import { Injectable } from "@nestjs/common";
import { Prisma, ResearchOpportunity } from "../../generated/prisma/client";
import { CoreHubIdentity as User } from "../auth/core-hub-identity";
import { Permission, can } from "../auth/permissions";
import { CollectionResult } from "../common/api-response";
import { AppException } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";
import { ReferenceDataService } from "../core-hub/reference-data.service";
import { Faculty } from "../core-hub/reference-data.types";
import {
  ApplicationDto,
  ApplicationStatusDto,
  AssistantDto,
  EvaluationDto,
  OpportunityDto,
  OpportunityPatchDto,
  QueryDto,
  ReportDto,
  TaskDto,
  TaskUpdateDto,
} from "./research.dto";

type Tx = Prisma.TransactionClient;
const validation = (message: string, field: string) =>
  new AppException("VALIDATION_ERROR", message, 400, { field });
const manager = (u: User) =>
  can(u.subsystemRole, Permission.MANAGE_OWN) ||
  can(u.subsystemRole, Permission.MANAGE_ANY);
const admin = (u: User) => can(u.subsystemRole, Permission.MANAGE_ANY);

@Injectable()
export class ResearchService {
  constructor(
    private readonly db: PrismaService,
    private readonly reference: ReferenceDataService,
  ) {}

  private async atomic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Serializable retries protect capacity checks and multi-row state transitions.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "P2034" && attempt < 2) continue;
        if (["P2002", "P2003", "P2025", "P2034"].includes(code ?? "")) {
          throw AppException.conflict(
            "ข้อมูลมีการเปลี่ยนแปลงหรือมีรายการซ้ำ กรุณาโหลดข้อมูลใหม่",
          );
        }
        throw error;
      }
    }
    throw AppException.conflict("กรุณาลองทำรายการอีกครั้ง");
  }

  private async opportunity(tx: Tx, id: string) {
    const item = await tx.researchOpportunity.findUnique({ where: { id } });
    if (!item) throw AppException.notFound("ไม่พบประกาศงานวิจัย");
    return item;
  }

  private manage(u: User, item: { coreUserId: string }) {
    if (
      !admin(u) &&
      !(can(u.subsystemRole, Permission.MANAGE_OWN) && item.coreUserId === u.id)
    ) {
      throw AppException.forbidden("จัดการได้เฉพาะงานวิจัยที่รับผิดชอบ");
    }
  }

  private visible(u: User, item: ResearchOpportunity) {
    if (item.status === "draft" && !admin(u) && item.coreUserId !== u.id) {
      throw AppException.forbidden("ไม่มีสิทธิ์เข้าถึงประกาศฉบับร่าง");
    }
  }

  private scope(u: User): {
    coreUserId?: string;
    opportunity?: { coreUserId: string };
  } {
    return admin(u)
      ? {}
      : manager(u)
        ? { opportunity: { coreUserId: u.id } }
        : { coreUserId: u.id };
  }

  private page<T>(data: T[], total: number, q: QueryDto) {
    return new CollectionResult(data, {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.ceil(total / q.limit),
    });
  }

  async dashboard(u: User) {
    const q = Object.assign(new QueryDto(), { page: 1, limit: 5 });
    const owned = Object.assign(new QueryDto(), q, manager(u) && !admin(u) ? { own: 'true' } : {});
    const [opportunities, applications, assistants, tasks, reports, evaluations, pending, completed, inProgress, upcoming] = await Promise.all([
      this.opportunities(u, owned), this.applications(u, q), this.assistants(u, q), this.tasks(u, q),
      this.reports(u, q), this.evaluations(u, q), this.applications(u, { ...q, status: 'pending' }),
      this.tasks(u, { ...q, status: 'completed' }), this.tasks(u, { ...q, status: 'in_progress' }),
      this.db.researchTask.findMany({where: {assistant: this.scope(u), status: {not: 'completed'}},
        include: {assistant: {include: {opportunity: true}}}, orderBy: [{dueDate: 'asc'}, {id: 'asc'}], take: 5}),
    ]);
    return {
      counts: { opportunities: opportunities.meta.total, applications: applications.meta.total,
        assistants: assistants.meta.total, tasks: tasks.meta.total, reports: reports.meta.total,
        evaluations: evaluations.meta.total, pendingApplications: pending.meta.total,
        completedTasks: completed.meta.total, inProgressTasks: inProgress.meta.total },
      recentOpportunities: opportunities.data, pendingApplications: pending.data, recentTasks: tasks.data, upcomingTasks: upcoming, recentReports: reports.data,
    };
  }

  async faculties(token: string, q: QueryDto) {
    const rows = (await this.reference.list<Faculty>("faculties", token)).filter((x) => x.isActive);
    return this.page(rows.slice((q.page - 1) * q.limit, q.page * q.limit), rows.length, q);
  }

  async opportunities(u: User, q: QueryDto) {
    if (q.status && !["draft", "open", "closed"].includes(q.status))
      throw validation("สถานะประกาศไม่ถูกต้อง", "status");
    const where: Prisma.ResearchOpportunityWhereInput = {
      AND: [
        admin(u)
          ? {}
          : { OR: [{ status: { not: "draft" } }, { coreUserId: u.id }] },
        q.own === "true" ? { coreUserId: u.id } : {},
        q.status ? { status: q.status as "draft" | "open" | "closed" } : {},
        q.faculty ? { faculty: q.faculty } : {},
        q.skill ? { requiredSkills: { has: q.skill } } : {},
        q.search
          ? { researchTitle: { contains: q.search, mode: "insensitive" } }
          : {},
      ],
    };
    const [rows, total] = await this.db.$transaction([
      this.db.researchOpportunity.findMany({
        where,
        include: { _count: { select: { assistants: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.researchOpportunity.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  async getOpportunity(u: User, id: string) {
    const item = await this.db.researchOpportunity.findUnique({
      where: { id },
      include: { _count: { select: { assistants: true } } },
    });
    if (!item) throw AppException.notFound("ไม่พบประกาศงานวิจัย");
    this.visible(u, item);
    return item;
  }

  private dates(d: OpportunityDto, createdAt: Date) {
    const startDate = new Date(d.startDate),
      endDate = new Date(d.endDate),
      applicationDeadline = new Date(d.applicationDeadline);
    if (endDate < startDate)
      throw validation("วันสิ้นสุดต้องไม่ก่อนวันเริ่มงาน", "endDate");
    if (applicationDeadline < createdAt || applicationDeadline > startDate)
      throw validation(
        "วันปิดรับสมัครต้องอยู่ระหว่างวันประกาศและวันเริ่มงาน",
        "applicationDeadline",
      );
    return { startDate, endDate, applicationDeadline };
  }

  async createOpportunity(u: User, d: OpportunityDto, token: string) {
    if (!manager(u)) throw AppException.forbidden();
    const dates = this.dates(d, new Date());
    await this.reference.assertActive("faculties", d.faculty, token);
    return this.db.researchOpportunity.create({
      data: { ...d, ...dates, coreUserId: u.id },
    });
  }

  async updateOpportunity(
    u: User,
    id: string,
    patch: OpportunityPatchDto,
    token: string,
  ) {
    const original = await this.opportunity(this.db, id);
    this.manage(u, original);
    if (patch.faculty !== undefined && patch.faculty !== original.faculty)
      await this.reference.assertActive("faculties", patch.faculty, token);

    return this.atomic(async (tx) => {
      const item = await this.opportunity(tx, id);
      this.manage(u, item);
      const d: OpportunityDto = { researchTitle: item.researchTitle, description: item.description,
        responsibilities: item.responsibilities, positions: item.positions, requiredSkills: item.requiredSkills,
        faculty: item.faculty, status: item.status, startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(), applicationDeadline: item.applicationDeadline.toISOString(),
        ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) };
      const dates = this.dates(d, item.createdAt);
      const count = await tx.researchAssistant.count({
        where: { researchOpportunityId: id },
      });
      if (d.positions < count)
        throw AppException.conflict(
          "จำนวนรับต้องไม่น้อยกว่าจำนวนผู้ช่วยที่อนุมัติแล้ว",
        );
      const invalidTasks = await tx.researchTask.count({
        where: {
          assistant: { researchOpportunityId: id },
          OR: [
            { dueDate: { lt: dates.startDate } },
            { dueDate: { gt: dates.endDate } },
          ],
        },
      });
      if (invalidTasks)
        throw AppException.conflict(
          "ช่วงวันใหม่ไม่ครอบคลุมกำหนดส่งงานที่มอบหมายไว้",
        );
      return tx.researchOpportunity.update({
        where: { id },
        data: { ...d, ...dates },
      });
    });
  }

  async deleteOpportunity(u: User, id: string) {
    return this.atomic(async (tx) => {
      this.manage(u, await this.opportunity(tx, id));
      if (
        await tx.researchApplication.count({
          where: { researchOpportunityId: id },
        })
      )
        throw AppException.conflict(
          "ประกาศมีใบสมัครแล้ว กรุณาปิดประกาศแทนการลบ",
        );
      await tx.researchOpportunity.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  async applications(u: User, q: QueryDto) {
    if (
      q.status &&
      !["pending", "approved", "rejected", "cancelled"].includes(q.status)
    )
      throw validation("สถานะใบสมัครไม่ถูกต้อง", "status");
    const where: Prisma.ResearchApplicationWhereInput = {
      ...this.scope(u),
      researchOpportunityId: q.researchOpportunityId,
      status: q.status as
        "pending" | "approved" | "rejected" | "cancelled" | undefined,
    };
    const [rows, total] = await this.db.$transaction([
      this.db.researchApplication.findMany({
        where,
        include: { opportunity: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.researchApplication.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  async apply(u: User, d: ApplicationDto) {
    if (!can(u.subsystemRole, Permission.APPLY))
      throw AppException.forbidden("เฉพาะนักศึกษาสมัครได้");
    return this.atomic(async (tx) => {
      const item = await this.opportunity(tx, d.researchOpportunityId);
      this.visible(u, item);
      if (item.status !== "open" || item.applicationDeadline <= new Date())
        throw AppException.conflict(
          "ประกาศไม่เปิดรับสมัครหรือหมดเขตรับสมัครแล้ว",
        );
      const count = await tx.researchAssistant.count({
        where: { researchOpportunityId: item.id },
      });
      if (count >= item.positions)
        throw AppException.conflict("จำนวนผู้ช่วยเต็มแล้ว");
      return tx.researchApplication.create({
        data: { ...d, coreUserId: u.id },
      });
    });
  }

  async reviewApplication(u: User, id: string, d: ApplicationStatusDto) {
    return this.atomic(async (tx) => {
      const item = await tx.researchApplication.findUnique({
        where: { id },
        include: { opportunity: true },
      });
      if (!item) throw AppException.notFound("ไม่พบใบสมัคร");
      if (!manager(u)) {
        if (item.coreUserId !== u.id || d.status !== "cancelled")
          throw AppException.forbidden("ยกเลิกได้เฉพาะใบสมัครของตนเอง");
      } else {
        this.manage(u, item.opportunity);
        if (d.status === "cancelled")
          throw validation(
            "ผู้ตรวจสามารถอนุมัติหรือปฏิเสธได้เท่านั้น",
            "status",
          );
      }
      if (item.status !== "pending")
        throw AppException.conflict("ใบสมัครนี้ถูกดำเนินการแล้ว");
      if (d.status === "approved") {
        const count = await tx.researchAssistant.count({
          where: { researchOpportunityId: item.researchOpportunityId },
        });
        if (count >= item.opportunity.positions)
          throw AppException.conflict("จำนวนผู้ช่วยเต็มแล้ว");
        await tx.researchAssistant.create({
          data: {
            researchOpportunityId: item.researchOpportunityId,
            researchApplicationId: id,
            coreUserId: item.coreUserId,
            responsibilities: item.opportunity.responsibilities,
          },
        });
      }
      return tx.researchApplication.update({
        where: { id },
        data: { status: d.status },
      });
    });
  }

  async assistants(u: User, q: QueryDto) {
    const where: Prisma.ResearchAssistantWhereInput = {
      ...this.scope(u),
      researchOpportunityId: q.researchOpportunityId,
    };
    const [rows, total] = await this.db.$transaction([
      this.db.researchAssistant.findMany({
        where,
        include: { opportunity: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.researchAssistant.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  private async assistant(tx: Tx, id: string) {
    const item = await tx.researchAssistant.findUnique({
      where: { id },
      include: { opportunity: true },
    });
    if (!item) throw AppException.notFound("ไม่พบผู้ช่วยวิจัย");
    return item;
  }

  async updateAssistant(u: User, id: string, d: AssistantDto) {
    const item = await this.assistant(this.db, id);
    this.manage(u, item.opportunity);
    return this.db.researchAssistant.update({ where: { id }, data: d });
  }

  async tasks(u: User, q: QueryDto) {
    if (q.status && !["todo", "in_progress", "completed"].includes(q.status))
      throw validation("สถานะงานไม่ถูกต้อง", "status");
    const where: Prisma.ResearchTaskWhereInput = {
      assistant: {
        ...this.scope(u),
        researchOpportunityId: q.researchOpportunityId,
      },
      researchAssistantId: q.researchAssistantId,
      status: q.status as "todo" | "in_progress" | "completed" | undefined,
    };
    const [rows, total] = await this.db.$transaction([
      this.db.researchTask.findMany({
        where,
        include: {
          assistant: { include: { opportunity: true } },
          reports: {
            where: manager(u) ? {} : { coreUserId: u.id },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: 1,
          },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.researchTask.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  private dueDate(value: string, opportunity: ResearchOpportunity) {
    const date = new Date(value);
    if (date < opportunity.startDate || date > opportunity.endDate)
      throw validation("กำหนดส่งต้องอยู่ในช่วงงานวิจัย", "dueDate");
    return date;
  }

  async createTask(u: User, d: TaskDto) {
    return this.atomic(async (tx) => {
      const assistant = await this.assistant(tx, d.researchAssistantId);
      this.manage(u, assistant.opportunity);
      return tx.researchTask.create({
        data: { ...d, dueDate: this.dueDate(d.dueDate, assistant.opportunity) },
      });
    });
  }

  async updateTask(u: User, id: string, d: TaskUpdateDto) {
    return this.atomic(async (tx) => {
      const item = await tx.researchTask.findUnique({
        where: { id },
        include: { assistant: { include: { opportunity: true } } },
      });
      if (!item) throw AppException.notFound("ไม่พบงานที่มอบหมาย");
      if (!manager(u)) {
        if (
          item.assistant.coreUserId !== u.id ||
          Object.keys(d).some((key) => key !== "status")
        )
          throw AppException.forbidden(
            "เปลี่ยนได้เฉพาะสถานะงานที่ตนได้รับมอบหมาย",
          );
        if (!d.status || !["in_progress", "completed"].includes(d.status))
          throw validation("เลือกสถานะกำลังทำหรือเสร็จสิ้น", "status");
        if (item.status === "completed" && d.status !== "completed")
          throw AppException.conflict(
            "งานเสร็จแล้ว ให้อาจารย์เป็นผู้เปิดงานใหม่",
          );
      } else {
        this.manage(u, item.assistant.opportunity);
      }
      if (!Object.keys(d).length)
        throw validation("กรุณาระบุข้อมูลที่ต้องการแก้ไข", "status");
      if (d.status === "completed") {
        const latestReport = await tx.progressReport.findFirst({
          where: { researchTaskId: item.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { progressPercentage: true },
        });
        if (latestReport?.progressPercentage !== 100)
          throw validation(
            "ส่งรายงานความคืบหน้าให้ถึง 100% ก่อนปิดงาน",
            "status",
          );
      }
      const next = d.researchAssistantId
        ? await this.assistant(tx, d.researchAssistantId)
        : item.assistant;
      if (next.researchOpportunityId !== item.assistant.researchOpportunityId)
        throw validation(
          "ผู้รับผิดชอบต้องอยู่ในงานวิจัยเดียวกัน",
          "researchAssistantId",
        );
      return tx.researchTask.update({
        where: { id },
        data: {
          ...d,
          dueDate: d.dueDate
            ? this.dueDate(d.dueDate, item.assistant.opportunity)
            : undefined,
        },
      });
    });
  }

  async reports(u: User, q: QueryDto) {
    const where: Prisma.ProgressReportWhereInput = {
      task: {
        assistant: {
          ...this.scope(u),
          researchOpportunityId: q.researchOpportunityId,
        },
      },
      researchTaskId: q.researchTaskId,
      ...(!manager(u) ? { coreUserId: u.id } : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.progressReport.findMany({
        where,
        include: { task: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.progressReport.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  async createReport(u: User, d: ReportDto) {
    if (!can(u.subsystemRole, Permission.REPORT))
      throw AppException.forbidden();
    return this.atomic(async (tx) => {
      const task = await tx.researchTask.findUnique({
        where: { id: d.researchTaskId },
        include: { assistant: true },
      });
      if (!task) throw AppException.notFound("ไม่พบงานที่มอบหมาย");
      if (task.assistant.coreUserId !== u.id)
        throw AppException.forbidden("รายงานได้เฉพาะงานที่ตนได้รับมอบหมาย");
      if (task.status === "completed")
        throw AppException.conflict(
          "งานเสร็จสิ้นแล้ว ไม่สามารถส่งรายงานความคืบหน้าเพิ่มได้",
        );
      const latestReport = await tx.progressReport.findFirst({
        where: { researchTaskId: task.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { progressPercentage: true },
      });
      if (
        latestReport &&
        d.progressPercentage < latestReport.progressPercentage
      )
        throw AppException.conflict(
          `เปอร์เซ็นต์ความคืบหน้าต้องไม่ลดลงจาก ${latestReport.progressPercentage}%`,
        );
      return tx.progressReport.create({ data: { ...d, coreUserId: u.id } });
    });
  }

  async evaluations(u: User, q: QueryDto) {
    const where: Prisma.ResearchEvaluationWhereInput = {
      assistant: {
        ...this.scope(u),
        researchOpportunityId: q.researchOpportunityId,
      },
      researchAssistantId: q.researchAssistantId,
    };
    const [rows, total] = await this.db.$transaction([
      this.db.researchEvaluation.findMany({
        where,
        include: { assistant: { include: { opportunity: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.researchEvaluation.count({ where }),
    ]);
    return this.page(rows, total, q);
  }

  async evaluate(u: User, d: EvaluationDto) {
    const assistant = await this.assistant(this.db, d.researchAssistantId);
    this.manage(u, assistant.opportunity);
    return this.db.researchEvaluation.create({
      data: { ...d, coreUserId: u.id },
    });
  }
}
