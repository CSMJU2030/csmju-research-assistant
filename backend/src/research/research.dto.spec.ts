import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  EvaluationDto,
  OpportunityDto,
  ReportDto,
  TaskUpdateDto,
} from "./research.dto";

describe("Domain validation", () => {
  it.each([-1, 101, 2.5])("rejects progress %s", async (value) => {
    const errors = await validate(
      plainToInstance(ReportDto, {
        researchTaskId: "11111111-1111-4111-8111-111111111111",
        progressPercentage: value,
        progressDetail: "Done",
      }),
    );
    expect(errors.some((e) => e.property === "progressPercentage")).toBe(true);
  });
  it.each([0, 6, 1.5])("rejects evaluation score %s", async (value) => {
    const errors = await validate(
      plainToInstance(EvaluationDto, {
        researchAssistantId: "11111111-1111-4111-8111-111111111111",
        responsibilityScore: value,
        qualityScore: 5,
        punctualityScore: 5,
        teamworkScore: 5,
      }),
    );
    expect(errors.some((e) => e.property === "responsibilityScore")).toBe(true);
  });
  it("rejects blank titles and dates without timezone", async () => {
    const errors = await validate(
      plainToInstance(OpportunityDto, {
        researchTitle: "  ",
        startDate: "2099-01-01",
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(["researchTitle", "startDate"]),
    );
  });
  it("rejects null updates", async () => {
    const errors = await validate(
      plainToInstance(TaskUpdateDto, { taskTitle: null }),
    );
    expect(errors.some((e) => e.property === "taskTitle")).toBe(true);
  });
});
