import { ResearchService } from "./research.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReferenceDataService } from "../core-hub/reference-data.service";
import { CoreHubIdentity, SubsystemRole } from "../auth/core-hub-identity";
import { OpportunityDto, QueryDto } from "./research.dto";

const user = (id: string, subsystemRole: SubsystemRole): CoreHubIdentity => ({
  id,
  subsystemRole,
  email: "test@example.test",
  coreRole: "test",
});
const student = user("student-a", SubsystemRole.STUDENT),
  staff = user("staff-a", SubsystemRole.STAFF),
  admin = user("admin-a", SubsystemRole.ADMIN);
const opportunity = {
  id: "opportunity",
  coreUserId: staff.id,
  status: "open",
  positions: 1,
  responsibilities: "Research",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  startDate: new Date("2099-01-10T00:00:00Z"),
  endDate: new Date("2099-02-10T00:00:00Z"),
  applicationDeadline: new Date("2099-01-09T00:00:00Z"),
};
const input: OpportunityDto = {
  researchTitle: "Research",
  description: "Description",
  responsibilities: "Research",
  positions: 1,
  requiredSkills: ["Python"],
  faculty: "SCI",
  status: "open",
  startDate: "2099-01-10T00:00:00Z",
  endDate: "2099-02-10T00:00:00Z",
  applicationDeadline: "2099-01-09T00:00:00Z",
};

describe("Research ownership and lifecycle", () => {
  let service: ResearchService;
  let tx: ReturnType<typeof database>;
  const reference = { assertActive: jest.fn(), list: jest.fn() };
  function database() {
    return {
      researchOpportunity: {
        findUnique: jest.fn().mockResolvedValue({...input, ...opportunity}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      researchApplication: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      researchAssistant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      researchTask: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      progressReport: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      researchEvaluation: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(),
    };
  }
  beforeEach(() => {
    tx = database();
    tx.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? arg(tx)
        : Promise.all(arg as Promise<unknown>[]),
    );
    service = new ResearchService(
      tx as unknown as PrismaService,
      reference as unknown as ReferenceDataService,
    );
  });
  it("prevents staff modifying another owner with 403", async () => {
    await expect(
      service.deleteOpportunity(
        user("staff-b", SubsystemRole.STAFF),
        opportunity.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.researchOpportunity.delete).not.toHaveBeenCalled();
  });
  it("allows admin deleting an unused opportunity", async () => {
    await expect(
      service.deleteOpportunity(admin, opportunity.id),
    ).resolves.toEqual({ id: opportunity.id, deleted: true });
  });
  it("blocks deleting opportunities with applications", async () => {
    tx.researchApplication.count.mockResolvedValue(1);
    await expect(
      service.deleteOpportunity(staff, opportunity.id),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects duplicate applications as 409", async () => {
    tx.researchApplication.create.mockRejectedValue({ code: "P2002" });
    await expect(
      service.apply(student, {
        researchOpportunityId: opportunity.id,
        reason: "Interested",
        skills: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects applications exactly at the deadline", async () => {
    jest.useFakeTimers().setSystemTime(opportunity.applicationDeadline);
    try {
      await expect(
        service.apply(student, {
          researchOpportunityId: opportunity.id,
          reason: "Interested",
          skills: [],
        }),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      jest.useRealTimers();
    }
  });
  it("prevents students approving their own application", async () => {
    tx.researchApplication.findUnique.mockResolvedValue({
      id: "app",
      coreUserId: student.id,
      status: "pending",
      opportunity,
    });
    await expect(
      service.reviewApplication(student, "app", { status: "approved" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("cannot approve above capacity", async () => {
    tx.researchApplication.findUnique.mockResolvedValue({
      id: "app",
      coreUserId: student.id,
      status: "pending",
      researchOpportunityId: opportunity.id,
      opportunity,
    });
    tx.researchAssistant.count.mockResolvedValue(1);
    await expect(
      service.reviewApplication(staff, "app", { status: "approved" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.researchAssistant.create).not.toHaveBeenCalled();
  });
  it("creates the assistant and approves together in a serializable transaction", async () => {
    tx.researchApplication.findUnique.mockResolvedValue({
      id: "app",
      coreUserId: student.id,
      status: "pending",
      researchOpportunityId: opportunity.id,
      opportunity,
    });
    await service.reviewApplication(staff, "app", { status: "approved" });
    expect(tx.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(tx.researchAssistant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coreUserId: student.id,
        researchApplicationId: "app",
      }),
    });
    expect(tx.researchApplication.update).toHaveBeenCalledWith({
      where: { id: "app" },
      data: { status: "approved" },
    });
  });
  it("retries serialization failures", async () => {
    tx.$transaction.mockRejectedValueOnce({ code: "P2034" });
    await service.deleteOpportunity(admin, opportunity.id);
    expect(tx.$transaction).toHaveBeenCalledTimes(2);
  });
  it("cannot reduce capacity below approved assistants", async () => {
    tx.researchAssistant.count.mockResolvedValue(2);
    await expect(
      service.updateOpportunity(staff, opportunity.id, input, "token"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("cannot change research dates outside existing task due dates", async () => {
    tx.researchTask.count.mockResolvedValue(1);
    await expect(
      service.updateOpportunity(staff, opportunity.id, input, "token"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects tasks outside the research period", async () => {
    tx.researchAssistant.findUnique.mockResolvedValue({
      id: "assistant",
      coreUserId: student.id,
      opportunity,
    });
    await expect(
      service.createTask(staff, {
        researchAssistantId: "assistant",
        taskTitle: "Task",
        description: "Task",
        priority: "high",
        dueDate: "2100-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("prevents students reassigning their task", async () => {
    tx.researchTask.findUnique.mockResolvedValue({
      id: "task",
      status: "todo",
      assistant: { coreUserId: student.id, opportunity },
    });
    await expect(
      service.updateTask(student, "task", { researchAssistantId: "other" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("prevents reports on another student task", async () => {
    tx.researchTask.findUnique.mockResolvedValue({
      id: "task",
      assistant: { coreUserId: "student-b" },
    });
    await expect(
      service.createReport(student, {
        researchTaskId: "task",
        progressPercentage: 10,
        progressDetail: "Working",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("scopes application lists to the student", async () => {
    await service.applications(student, new QueryDto());
    expect(tx.researchApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ coreUserId: student.id }),
      }),
    );
  });
  it("scopes staff lists to owned research", async () => {
    await service.applications(staff, new QueryDto());
    expect(tx.researchApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          opportunity: { coreUserId: staff.id },
        }),
      }),
    );
  });

  it('PATCH closes a project without erasing other fields or requiring Core to be online',async()=> {
    reference.assertActive.mockClear();
    await service.updateOpportunity(staff, opportunity.id, {status:'closed'},'token');
    expect(tx.researchOpportunity.update).toHaveBeenCalledWith({where:{id:opportunity.id},data:expect.objectContaining({researchTitle:input.researchTitle,positions:1,status:'closed',faculty:'SCI'})});
    expect(reference.assertActive).not.toHaveBeenCalled();
  });
  it.each([student,staff,admin])('dashboard applies the scope for $subsystemRole to upcoming tasks and reports',async(u)=> {
    const result=await service.dashboard(u);
    const scope=u===admin?{}:u===staff?{opportunity:{coreUserId:u.id}}:{coreUserId:u.id};
    expect(tx.researchTask.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{assistant:scope,status:{not:'completed'}},take:5}));
    expect(result.counts.tasks).toBe(0);expect(result.recentReports).toEqual([]);
  });
});
