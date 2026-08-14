import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["OWNER", "ADMIN", "OPERATOR", "VIEWER"]).default("VIEWER").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("organizationMembers_org_user").on(table.organizationId, table.userId)]);

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("projects_org_idx").on(table.organizationId)]);

export const agentDefinitions = mysqlTable("agentDefinitions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT").notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "restrict" }),
  isTemplate: boolean("isTemplate").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
}, table => [uniqueIndex("agents_org_slug").on(table.organizationId, table.slug), index("agents_org_status_idx").on(table.organizationId, table.status)]);

export const agentVersions = mysqlTable("agentVersions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull().references(() => agentDefinitions.id, { onDelete: "cascade" }),
  version: int("version").notNull(),
  systemPrompt: text("systemPrompt").notNull(),
  providerKey: varchar("providerKey", { length: 80 }).notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  memoryConfig: json("memoryConfig").$type<Record<string, unknown>>().notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  outputSchema: json("outputSchema").$type<Record<string, unknown>>(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("agentVersions_agent_version").on(table.agentId, table.version)]);

export const agentTeams = mysqlTable("agentTeams", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  supervisorAgentId: varchar("supervisorAgentId", { length: 36 }).references(() => agentDefinitions.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentTeamMembers = mysqlTable("agentTeamMembers", {
  id: int("id").autoincrement().primaryKey(),
  teamId: varchar("teamId", { length: 36 }).notNull().references(() => agentTeams.id, { onDelete: "cascade" }),
  agentId: varchar("agentId", { length: 36 }).notNull().references(() => agentDefinitions.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["SUPERVISOR", "MEMBER"]).default("MEMBER").notNull(),
}, table => [uniqueIndex("agentTeamMembers_team_agent").on(table.teamId, table.agentId)]);

export const tools = mysqlTable("tools", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull(),
  description: text("description"),
  kind: mysqlEnum("kind", ["BUILT_IN", "HTTP", "MCP", "CODE", "EXTERNAL"]).default("BUILT_IN").notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DISABLED"]).default("DRAFT").notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("tools_org_slug").on(table.organizationId, table.slug)]);

export const toolVersions = mysqlTable("toolVersions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  toolId: varchar("toolId", { length: 36 }).notNull().references(() => tools.id, { onDelete: "cascade" }),
  version: int("version").notNull(),
  inputSchema: json("inputSchema").$type<Record<string, unknown>>().notNull(),
  outputSchema: json("outputSchema").$type<Record<string, unknown>>().notNull(),
  requiredCapabilities: json("requiredCapabilities").$type<string[]>().notNull(),
  runtimeConfig: json("runtimeConfig").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("toolVersions_tool_version").on(table.toolId, table.version)]);

export const agentTools = mysqlTable("agentTools", {
  id: int("id").autoincrement().primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull().references(() => agentDefinitions.id, { onDelete: "cascade" }),
  toolId: varchar("toolId", { length: 36 }).notNull().references(() => tools.id, { onDelete: "cascade" }),
  allowed: boolean("allowed").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("agentTools_agent_tool").on(table.agentId, table.toolId)]);

export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
  parentTaskId: varchar("parentTaskId", { length: 36 }),
  assignedAgentId: varchar("assignedAgentId", { length: 36 }).references(() => agentDefinitions.id, { onDelete: "set null" }),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 240 }).notNull(),
  input: json("input").$type<Record<string, unknown>>().notNull(),
  output: json("output").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["PENDING", "QUEUED", "RUNNING", "WAITING", "BLOCKED", "REQUIRES_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"]).default("PENDING").notNull(),
  priority: mysqlEnum("priority", ["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL").notNull(),
  error: json("error").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
}, table => [index("tasks_org_status_idx").on(table.organizationId, table.status), index("tasks_parent_idx").on(table.parentTaskId)]);

export const taskExecutions = mysqlTable("taskExecutions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  taskId: varchar("taskId", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  agentId: varchar("agentId", { length: 36 }).references(() => agentDefinitions.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  trace: json("trace").$type<Array<Record<string, unknown>>>().notNull(),
  inputTokens: int("inputTokens").default(0).notNull(),
  outputTokens: int("outputTokens").default(0).notNull(),
  estimatedCostMicros: int("estimatedCostMicros").default(0).notNull(),
  latencyMs: int("latencyMs"),
  error: json("error").$type<Record<string, unknown>>(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("taskExecutions_task_idx").on(table.taskId)]);

export const workflows = mysqlTable("workflows", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT").notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("workflows_org_status_idx").on(table.organizationId, table.status), index("workflows_schedule_idx").on(table.scheduleCronTaskUid)]);

export const workflowVersions = mysqlTable("workflowVersions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workflowId: varchar("workflowId", { length: 36 }).notNull().references(() => workflows.id, { onDelete: "cascade" }),
  version: int("version").notNull(),
  definition: json("definition").$type<Record<string, unknown>>().notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("workflowVersions_workflow_version").on(table.workflowId, table.version)]);

export const workflowNodes = mysqlTable("workflowNodes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workflowVersionId: varchar("workflowVersionId", { length: 36 }).notNull().references(() => workflowVersions.id, { onDelete: "cascade" }),
  nodeKey: varchar("nodeKey", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["TRIGGER", "AGENT", "TOOL", "CONDITION", "APPROVAL", "LOOP", "OUTPUT"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(),
}, table => [uniqueIndex("workflowNodes_version_key").on(table.workflowVersionId, table.nodeKey)]);

export const workflowExecutions = mysqlTable("workflowExecutions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workflowId: varchar("workflowId", { length: 36 }).notNull().references(() => workflows.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  trace: json("trace").$type<Array<Record<string, unknown>>>().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("workflowExecutions_workflow_idx").on(table.workflowId)]);

export const memories = mysqlTable("memories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  module: mysqlEnum("module", ["ConversationMemory", "WorkingMemory", "LongTermMemory", "EpisodicMemory", "SemanticMemory"]).notNull(),
  scope: varchar("scope", { length: 160 }).notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const memoryEntries = mysqlTable("memoryEntries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  memoryId: varchar("memoryId", { length: 36 }).notNull().references(() => memories.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  embeddingRef: varchar("embeddingRef", { length: 200 }),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("memoryEntries_memory_idx").on(table.memoryId)]);

export const conversations = mysqlTable("conversations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  conversationId: varchar("conversationId", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["SYSTEM", "USER", "ASSISTANT", "TOOL"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const artifacts = mysqlTable("artifacts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
  name: varchar("name", { length: 240 }).notNull(),
  objectKey: varchar("objectKey", { length: 512 }).notNull(),
  mediaType: varchar("mediaType", { length: 120 }).notNull(),
  byteSize: int("byteSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const eventRecords = mysqlTable("eventRecords", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 160 }).notNull(),
  aggregateId: varchar("aggregateId", { length: 36 }),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [index("eventRecords_org_occurred_idx").on(table.organizationId, table.occurredAt)]);

export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 120 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "RETRYING", "COMPLETED", "FAILED", "CANCELLED"]).default("QUEUED").notNull(),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  runAfter: timestamp("runAfter").defaultNow().notNull(),
  lockedAt: timestamp("lockedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("jobs_status_runAfter_idx").on(table.status, table.runAfter)]);

export const approvals = mysqlTable("approvals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  requestedByAgentId: varchar("requestedByAgentId", { length: 36 }).references(() => agentDefinitions.id, { onDelete: "set null" }),
  actionType: varchar("actionType", { length: 160 }).notNull(),
  summary: text("summary").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]).default("PENDING").notNull(),
  resolvedBy: int("resolvedBy").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: text("resolutionNote"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, table => [index("approvals_org_status_idx").on(table.organizationId, table.status)]);

export const auditLogs = mysqlTable("auditLogs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entityType", { length: 120 }).notNull(),
  entityId: varchar("entityId", { length: 36 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("auditLogs_org_created_idx").on(table.organizationId, table.createdAt)]);

export const apiKeys = mysqlTable("apiKeys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  prefix: varchar("prefix", { length: 16 }).notNull(),
  hashedSecret: varchar("hashedSecret", { length: 255 }).notNull(),
  scopes: json("scopes").$type<string[]>().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const integrations = mysqlTable("integrations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 80 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DISABLED", "ERROR"]).default("DRAFT").notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(),
  secretReference: varchar("secretReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const externalAgents = mysqlTable("externalAgents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  endpoint: varchar("endpoint", { length: 2048 }).notNull(),
  protocol: varchar("protocol", { length: 80 }).notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DISABLED", "ERROR"]).default("DRAFT").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mcpConnections = mysqlTable("mcpConnections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  transport: mysqlEnum("transport", ["STDIO", "SSE", "HTTP"]).notNull(),
  endpoint: varchar("endpoint", { length: 2048 }),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DISABLED", "ERROR"]).default("DRAFT").notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(),
  secretReference: varchar("secretReference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const llmProviders = mysqlTable("llmProviders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  providerKey: varchar("providerKey", { length: 80 }).notNull(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "DISABLED", "ERROR"]).default("DRAFT").notNull(),
  secretReference: varchar("secretReference", { length: 255 }),
  config: json("config").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("llmProviders_org_key").on(table.organizationId, table.providerKey)]);

export const usageRecords = mysqlTable("usageRecords", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  taskExecutionId: varchar("taskExecutionId", { length: 36 }).references(() => taskExecutions.id, { onDelete: "set null" }),
  providerKey: varchar("providerKey", { length: 80 }).notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  inputTokens: int("inputTokens").default(0).notNull(),
  outputTokens: int("outputTokens").default(0).notNull(),
  estimatedCostMicros: int("estimatedCostMicros").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("usageRecords_org_created_idx").on(table.organizationId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
