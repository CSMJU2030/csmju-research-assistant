import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const timezone = /(?:Z|[+-]\d{2}:\d{2})$/;

export class QueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  search?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  faculty?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  skill?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([
    "draft",
    "open",
    "closed",
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "todo",
    "in_progress",
    "completed",
  ])
  status?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  researchOpportunityId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  researchAssistantId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  researchTaskId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(["true", "false"])
  own?: string;
}

export class OpportunityDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  researchTitle!: string;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  responsibilities!: string;
  @IsInt() @Min(1) @Max(1000) positions!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(100, { each: true })
  requiredSkills!: string[];
  @IsDateString({ strict: true }) @Matches(timezone) startDate!: string;
  @IsDateString({ strict: true }) @Matches(timezone) endDate!: string;
  @IsDateString({ strict: true })
  @Matches(timezone)
  applicationDeadline!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) faculty!: string;
  @IsIn(["draft", "open", "closed"]) status!: "draft" | "open" | "closed";
}
export class OpportunityPatchDto {
  @ValidateIf((_object, value) => value !== undefined)
@Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  researchTitle?: string;
  @ValidateIf((_object, value) => value !== undefined)
@Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
@Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  responsibilities?: string;
  @ValidateIf((_object, value) => value !== undefined)
@IsInt() @Min(1) @Max(1000) positions?: number;
  @ValidateIf((_object, value) => value !== undefined)
@IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(100, { each: true })
  requiredSkills?: string[];
  @ValidateIf((_object, value) => value !== undefined)
@IsDateString({ strict: true }) @Matches(timezone) startDate?: string;
  @ValidateIf((_object, value) => value !== undefined)
@IsDateString({ strict: true }) @Matches(timezone) endDate?: string;
  @ValidateIf((_object, value) => value !== undefined)
@IsDateString({ strict: true })
  @Matches(timezone)
  applicationDeadline?: string;
  @ValidateIf((_object, value) => value !== undefined)
@Transform(trim) @IsString() @MinLength(1) @MaxLength(100) faculty?: string;
  @ValidateIf((_object, value) => value !== undefined)
@IsIn(["draft", "open", "closed"]) status?: "draft" | "open" | "closed";
}

export class ApplicationDto {
  @IsUUID("4") researchOpportunityId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(10000) reason!: string;
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(100, { each: true })
  skills: string[] = [];
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  experience?: string;
}
export class ApplicationStatusDto {
  @IsIn(["approved", "rejected", "cancelled"]) status!:
    "approved" | "rejected" | "cancelled";
}
export class AssistantDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  responsibilities!: string;
}
export class TaskDto {
  @IsUUID("4") researchAssistantId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) taskTitle!: string;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;
  @IsDateString({ strict: true }) @Matches(timezone) dueDate!: string;
  @IsIn(["low", "medium", "high"]) priority!: "low" | "medium" | "high";
}
export class TaskUpdateDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  researchAssistantId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  taskTitle?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(timezone)
  dueDate?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(["low", "medium", "high"])
  priority?: "low" | "medium" | "high";
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(["todo", "in_progress", "completed"])
  status?: "todo" | "in_progress" | "completed";
}
export class ReportDto {
  @IsUUID("4") researchTaskId!: string;
  @IsInt() @Min(0) @Max(100) progressPercentage!: number;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  progressDetail!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  problems?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  nextAction?: string;
}
export class EvaluationDto {
  @IsUUID("4") researchAssistantId!: string;
  @IsInt() @Min(1) @Max(5) responsibilityScore!: number;
  @IsInt() @Min(1) @Max(5) qualityScore!: number;
  @IsInt() @Min(1) @Max(5) punctualityScore!: number;
  @IsInt() @Min(1) @Max(5) teamworkScore!: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  comment?: string;
}
