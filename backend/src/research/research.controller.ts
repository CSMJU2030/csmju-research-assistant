import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Put,
  Query,
} from "@nestjs/common";
import { CoreHubIdentity } from "../auth/core-hub-identity";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CoreHubAccessToken } from "../auth/decorators/core-hub-access-token.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { Permission as P } from "../auth/permissions";
import { ResearchService } from "./research.service";
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

const uuid = new ParseUUIDPipe({ version: "4" });

@Controller("v1")
@RequirePermissions(P.READ)
export class ResearchController {
  constructor(private readonly service: ResearchService) {}
  @Get("dashboards") dashboard(@CurrentUser() u: CoreHubIdentity) { return this.service.dashboard(u); }
  @Get("faculties") faculties(@CoreHubAccessToken() token: string, @Query() q: QueryDto) {
    return this.service.faculties(token, q);
  }
  @Get("research-opportunities") opportunities(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.opportunities(u, q);
  }
  @Get("research-opportunities/:id") opportunity(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
  ) {
    return this.service.getOpportunity(u, id);
  }
  @Post("research-opportunities")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  createOpportunity(
    @CurrentUser() u: CoreHubIdentity,
    @Body() d: OpportunityDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.service.createOpportunity(u, d, token);
  }
  @Patch("research-opportunities/:id")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  updateOpportunity(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
    @Body() d: OpportunityPatchDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.service.updateOpportunity(u, id, d, token);
  }
  @Delete("research-opportunities/:id")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  deleteOpportunity(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
  ) {
    return this.service.deleteOpportunity(u, id);
  }
  @Get("research-applications") applications(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.applications(u, q);
  }
  @Post("research-applications")
  @RequirePermissions(P.APPLY)
  apply(@CurrentUser() u: CoreHubIdentity, @Body() d: ApplicationDto) {
    return this.service.apply(u, d);
  }
  @Patch("research-applications/:id") review(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
    @Body() d: ApplicationStatusDto,
  ) {
    return this.service.reviewApplication(u, id, d);
  }
  @Get("research-assistants") assistants(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.assistants(u, q);
  }
  @Patch("research-assistants/:id")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  updateAssistant(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
    @Body() d: AssistantDto,
  ) {
    return this.service.updateAssistant(u, id, d);
  }
  @Get("research-tasks") tasks(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.tasks(u, q);
  }
  @Post("research-tasks")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  createTask(@CurrentUser() u: CoreHubIdentity, @Body() d: TaskDto) {
    return this.service.createTask(u, d);
  }
  @Patch("research-tasks/:id") updateTask(
    @CurrentUser() u: CoreHubIdentity,
    @Param("id", uuid) id: string,
    @Body() d: TaskUpdateDto,
  ) {
    return this.service.updateTask(u, id, d);
  }
  @Get("progress-reports") reports(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.reports(u, q);
  }
  @Post("progress-reports")
  @RequirePermissions(P.REPORT)
  report(@CurrentUser() u: CoreHubIdentity, @Body() d: ReportDto) {
    return this.service.createReport(u, d);
  }
  @Get("research-evaluations") evaluations(
    @CurrentUser() u: CoreHubIdentity,
    @Query() q: QueryDto,
  ) {
    return this.service.evaluations(u, q);
  }
  @Post("research-evaluations")
  @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  evaluate(@CurrentUser() u: CoreHubIdentity, @Body() d: EvaluationDto) {
    return this.service.evaluate(u, d);
  }

  // Compatibility with existing clients. New clients use PATCH.
  @Put('research-opportunities/:id') @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  replaceOpportunity(@CurrentUser() u: CoreHubIdentity, @Param('id', uuid) id: string,
    @Body() d: OpportunityDto, @CoreHubAccessToken() token: string) { return this.service.updateOpportunity(u, id, d, token); }
  @Put('research-applications/:id')
  replaceApplication(@CurrentUser() u: CoreHubIdentity, @Param('id', uuid) id: string,
    @Body() d: ApplicationStatusDto) { return this.service.reviewApplication(u, id, d); }
  @Put('research-assistants/:id') @RequirePermissions(P.MANAGE_OWN, P.MANAGE_ANY)
  replaceAssistant(@CurrentUser() u: CoreHubIdentity, @Param('id', uuid) id: string,
    @Body() d: AssistantDto) { return this.service.updateAssistant(u, id, d); }
  @Put('research-tasks/:id')
  replaceTask(@CurrentUser() u: CoreHubIdentity, @Param('id', uuid) id: string,
    @Body() d: TaskUpdateDto) { return this.service.updateTask(u, id, d); }
}
