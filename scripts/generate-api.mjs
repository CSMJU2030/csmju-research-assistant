import { writeFileSync } from "node:fs";
const str = { type: "string" },
  date = { ...str, format: "date-time" },
  uuid = { ...str, format: "uuid" };
const text = (maxLength) => ({ ...str, minLength: 1, maxLength });
const integer = (minimum, maximum) => ({
  type: "integer",
  minimum,
  ...(maximum === undefined ? {} : { maximum }),
});
const values = (...items) => ({ ...str, enum: items });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (items) => ({ type: "array", items });
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const skills = { ...array(text(100)), maxItems: 50 };
const schemas = {
  OpportunityInput: object({
    researchTitle: text(240),
    description: text(10000),
    responsibilities: text(10000),
    positions: integer(1, 1000),
    requiredSkills: { ...skills, minItems: 1 },
    startDate: date,
    endDate: date,
    applicationDeadline: date,
    faculty: text(100),
    status: values("draft", "open", "closed"),
  }),
  ApplicationInput: object(
    {
      researchOpportunityId: uuid,
      reason: text(10000),
      skills,
      experience: { ...str, maxLength: 10000 },
    },
    ["researchOpportunityId", "reason"],
  ),
  ApplicationStatusInput: object({
    status: values("approved", "rejected", "cancelled"),
  }),
  AssistantInput: object({ responsibilities: text(10000) }),
  TaskInput: object({
    researchAssistantId: uuid,
    taskTitle: text(240),
    description: text(10000),
    dueDate: date,
    priority: values("low", "medium", "high"),
  }),
  ReportInput: object(
    {
      researchTaskId: uuid,
      progressPercentage: integer(0, 100),
      progressDetail: text(10000),
      problems: str,
      nextAction: str,
    },
    ["researchTaskId", "progressPercentage", "progressDetail"],
  ),
  EvaluationInput: object(
    {
      researchAssistantId: uuid,
      responsibilityScore: integer(1, 5),
      qualityScore: integer(1, 5),
      punctualityScore: integer(1, 5),
      teamworkScore: integer(1, 5),
      comment: str,
    },
    [
      "researchAssistantId",
      "responsibilityScore",
      "qualityScore",
      "punctualityScore",
      "teamworkScore",
    ],
  ),
  Me: object({
    id: str,
    email: str,
    coreRole: str,
    subsystemRole: values("guest", "editor", "admin"),
  }),
  Faculty: object({
    code: str,
    nameTh: str,
    nameEn: str,
    isActive: { type: "boolean" },
    updatedAt: date,
  }),
  Meta: object({
    total: integer(0),
    page: integer(1),
    limit: integer(1, 100),
    totalPages: integer(0),
  }),
  Error: object({
    success: { type: "boolean", enum: [false] },
    error: object(
      {
        code: values(
          "BAD_REQUEST",
          "VALIDATION_ERROR",
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "CONFLICT",
          "INTERNAL_ERROR",
        ),
        message: str,
        details: {},
      },
      ["code", "message"],
    ),
  }),
};
schemas.TaskUpdateInput = object(
  {
    ...schemas.TaskInput.properties,
    status: values("todo", "in_progress", "completed"),
  },
  [],
);
const base = { id: uuid, createdAt: date, updatedAt: date };
schemas.Opportunity = object(
  {
    ...base,
    ...schemas.OpportunityInput.properties,
    coreUserId: str,
    _count: object({ assistants: integer(0) }),
  },
  [
    ...Object.keys(base),
    ...Object.keys(schemas.OpportunityInput.properties),
    "coreUserId",
  ],
);
schemas.Application = object(
  {
    ...base,
    ...schemas.ApplicationInput.properties,
    skills,
    experience: { ...str, nullable: true },
    coreUserId: str,
    status: values("pending", "approved", "rejected", "cancelled"),
    opportunity: ref("Opportunity"),
  },
  [
    ...Object.keys(base),
    "researchOpportunityId",
    "reason",
    "skills",
    "coreUserId",
    "status",
  ],
);
schemas.Assistant = object(
  {
    ...base,
    researchOpportunityId: uuid,
    researchApplicationId: uuid,
    coreUserId: str,
    responsibilities: str,
    opportunity: ref("Opportunity"),
  },
  [
    ...Object.keys(base),
    "researchOpportunityId",
    "researchApplicationId",
    "coreUserId",
    "responsibilities",
  ],
);
schemas.Task = object(
  {
    ...base,
    ...schemas.TaskInput.properties,
    status: values("todo", "in_progress", "completed"),
    assistant: ref("Assistant"),
    reports: array(ref("Report")),
  },
  [
    ...Object.keys(base),
    ...Object.keys(schemas.TaskInput.properties),
    "status",
  ],
);
schemas.Report = object(
  {
    ...base,
    ...schemas.ReportInput.properties,
    problems: { ...str, nullable: true },
    nextAction: { ...str, nullable: true },
    coreUserId: str,
    task: ref("Task"),
  },
  [
    ...Object.keys(base),
    "researchTaskId",
    "progressPercentage",
    "progressDetail",
    "coreUserId",
  ],
);
schemas.Evaluation = object(
  {
    ...base,
    ...schemas.EvaluationInput.properties,
    comment: { ...str, nullable: true },
    coreUserId: str,
    assistant: ref("Assistant"),
  },
  [...Object.keys(base), ...schemas.EvaluationInput.required, "coreUserId"],
);
const response = (schema, collection = false) => ({
  description: "Standard success envelope",
  content: {
    "application/json": {
      schema: object({
        success: { type: "boolean", enum: [true] },
        data: collection ? array(schema) : schema,
        ...(collection ? { meta: ref("Meta") } : {}),
      }),
    },
  },
});
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 500].map((code) => [
    code,
    {
      description: "Standard error envelope",
      content: { "application/json": { schema: ref("Error") } },
    },
  ]),
);
const body = (schema) => ({
  required: true,
  content: { "application/json": { schema: ref(schema) } },
});
const paths = {};
const resources = [
  [
    "research-opportunities",
    "Opportunity",
    "OpportunityInput",
    "OpportunityInput",
    true,
  ],
  [
    "research-applications",
    "Application",
    "ApplicationInput",
    "ApplicationStatusInput",
  ],
  ["research-assistants", "Assistant", null, "AssistantInput"],
  ["research-tasks", "Task", "TaskInput", "TaskUpdateInput"],
  ["progress-reports", "Report", "ReportInput"],
  ["research-evaluations", "Evaluation", "EvaluationInput"],
];
for (const [resource, model, create, update, remove] of resources) {
  const path = `/api/v1/${resource}`;
  paths[path] = {
    get: {
      operationId: `list_${resource.replaceAll("-", "_")}`,
      parameters: [
        ...["page", "limit"].map((name) => ({
          name,
          in: "query",
          schema: integer(1, name === "limit" ? 100 : undefined),
        })),
        ...[
          "search",
          "skill",
          "faculty",
          "status",
          "own",
          "researchOpportunityId",
          "researchAssistantId",
          "researchTaskId",
        ].map((name) => ({ name, in: "query", schema: str })),
      ],
      responses: { 200: response(ref(model), true), ...errors },
    },
  };
  if (create)
    paths[path].post = {
      requestBody: body(create),
      responses: { 201: response(ref(model)), ...errors },
    };
  if (update)
    paths[`${path}/{id}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      put: {
        requestBody: body(update),
        responses: { 200: response(ref(model)), ...errors },
      },
    };
  if (remove) {
    paths[`${path}/{id}`].get = {
      responses: { 200: response(ref(model)), ...errors },
    };
    paths[`${path}/{id}`].delete = {
      responses: {
        200: response(object({ id: uuid, deleted: { type: "boolean" } })),
        ...errors,
      },
    };
  }
}
paths["/api/v1/me"] = {
  get: { responses: { 200: response(ref("Me")), ...errors } },
};
paths["/api/v1/faculties"] = {
  get: {
    responses: {
      200: {
        description: "Active faculties from Core Hub",
        content: {
          "application/json": {
            schema: object({
              success: { type: "boolean" },
              data: array(ref("Faculty")),
              meta: ref("Meta"),
            }),
          },
        },
      },
      ...errors,
    },
  },
};
paths["/api/health"] = {
  get: {
    security: [],
    responses: {
      200: response(object({ status: values("ok"), service: str })),
    },
  },
};
paths["/auth/callback"] = {
  get: {
    security: [],
    parameters: [
      { name: "access_token", in: "query", required: true, schema: str },
      { name: "state", in: "query", schema: str },
    ],
    responses: {
      200: response(
        object(
          {
            ...schemas.Me.properties,
            session: object({ source: str, expiresIn: integer(0) }),
            state: str,
          },
          [...Object.keys(schemas.Me.properties), "session"],
        ),
      ),
      302: { description: "Browser redirect with HttpOnly SSO cookie" },
      ...errors,
    },
  },
};
writeFileSync(
  new URL("../backend/openapi.json", import.meta.url),
  JSON.stringify(
    {
      openapi: "3.0.3",
      info: { title: "CSMJU Research Assistant API", version: "1.0.0" },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      paths,
      components: {
        schemas,
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "core_hub_access_token",
          },
        },
      },
    },
    null,
    2,
  ) + "\n",
);
