import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import {
  agentDefinitions,
  agentTeamMembers,
  agentTeams,
  agentTools,
  agentVersions,
  apiKeys,
  approvals,
  artifacts,
  auditLogs,
  eventRecords,
  jobs,
  memories,
  organizationMembers,
  organizations,
  taskExecutions,
  tasks,
  toolVersions,
  tools,
  usageRecords,
  workflowExecutions,
  workflowNodes,
  workflowVersions,
  workflows,
} from "../drizzle/schema";
import type { TaskPriority, TaskStatus, WorkflowDefinition } from "../shared/agentos";
import { getDb } from "./db";

type Viewer = { id: number; name: string | null; role: "user" | "admin" };

const identifier = () => nanoid(21);

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ["QUEUED", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING", "BLOCKED", "REQUIRES_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING: ["QUEUED", "BLOCKED", "CANCELLED"],
  BLOCKED: ["QUEUED", "CANCELLED"],
  REQUIRES_APPROVAL: ["QUEUED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function assertTaskTransition(from: TaskStatus, to: TaskStatus) {
  if (!taskTransitions[from].includes(to)) {
    throw new Error(`Task transition ${from} → ${to} is not permitted.`);
  }
}

function workspaceSlug(userId: number) {
  return `workspace-${userId}`;
}

export async function getWorkspace(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");

  const membership = await db
    .select({ organization: organizations, member: organizationMembers })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, viewer.id))
    .limit(1);

  if (membership[0]) return membership[0];

  const result = await db.insert(organizations).values({
    name: viewer.name ? `${viewer.name}'s workspace` : "AgentOS workspace",
    slug: workspaceSlug(viewer.id),
  });
  const organizationId = Number(result[0].insertId);
  await db.insert(organizationMembers).values({
    organizationId,
    userId: viewer.id,
    role: viewer.role === "admin" ? "ADMIN" : "OWNER",
  });

  const created = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!created[0]) throw new Error("Unable to create the AgentOS workspace.");
  return {
    organization: created[0],
    member: { id: 0, organizationId, userId: viewer.id, role: viewer.role === "admin" ? "ADMIN" as const : "OWNER" as const, createdAt: new Date() },
  };
}

async function appendEvent(input: {
  organizationId: number;
  type: `agent.${string}` | `task.${string}` | `tool.${string}` | `workflow.${string}` | `approval.${string}`;
  aggregateId?: string;
  payload: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  await db.insert(eventRecords).values({ id: identifier(), ...input });
}

async function audit(input: { organizationId: number; actorUserId: number; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  await db.insert(auditLogs).values({ id: identifier(), ...input });
}

export async function getDashboard(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const orgId = organization.id;
  const countFor = async (table: typeof tasks | typeof agentDefinitions | typeof workflows | typeof approvals, predicate: ReturnType<typeof eq> | ReturnType<typeof and>) => {
    const result = await db.select({ value: count() }).from(table).where(predicate);
    return Number(result[0]?.value ?? 0);
  };
  const [activeAgents, runningTasks, completedTasks, failedTasks, workflowRuns, pendingApprovals, usage, recentEvents] = await Promise.all([
    countFor(agentDefinitions, and(eq(agentDefinitions.organizationId, orgId), eq(agentDefinitions.status, "ACTIVE"))),
    countFor(tasks, and(eq(tasks.organizationId, orgId), inArray(tasks.status, ["QUEUED", "RUNNING", "WAITING", "BLOCKED", "REQUIRES_APPROVAL"]))),
    countFor(tasks, and(eq(tasks.organizationId, orgId), eq(tasks.status, "COMPLETED"))),
    countFor(tasks, and(eq(tasks.organizationId, orgId), eq(tasks.status, "FAILED"))),
    db.select({ value: count() }).from(workflowExecutions).innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id)).where(eq(workflows.organizationId, orgId)),
    countFor(approvals, and(eq(approvals.organizationId, orgId), eq(approvals.status, "PENDING"))),
    db.select({ inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`, outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`, estimatedCostMicros: sql<number>`coalesce(sum(${usageRecords.estimatedCostMicros}), 0)` }).from(usageRecords).where(eq(usageRecords.organizationId, orgId)),
    db.select().from(eventRecords).where(eq(eventRecords.organizationId, orgId)).orderBy(desc(eventRecords.occurredAt)).limit(8),
  ]);
  return {
    organization,
    metrics: {
      activeAgents,
      runningTasks,
      completedTasks,
      failedTasks,
      workflowRuns: Number(workflowRuns[0]?.value ?? 0),
      pendingApprovals,
      inputTokens: Number(usage[0]?.inputTokens ?? 0),
      outputTokens: Number(usage[0]?.outputTokens ?? 0),
      estimatedCostUsd: Number(usage[0]?.estimatedCostMicros ?? 0) / 1_000_000,
    },
    health: { database: "HEALTHY" as const, queue: "READY" as const, runtime: "ADAPTER_REQUIRED" as const },
    recentEvents,
  };
}

export async function listAgents(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(agentDefinitions).where(and(eq(agentDefinitions.organizationId, organization.id), sql`${agentDefinitions.deletedAt} is null`)).orderBy(desc(agentDefinitions.updatedAt));
}

export async function createAgent(viewer: Viewer, input: { name: string; description?: string; systemPrompt: string; providerKey: string; model: string; capabilities: string[]; isTemplate?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const id = identifier();
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "agent"}-${id.slice(-5)}`;
  await db.transaction(async tx => {
    await tx.insert(agentDefinitions).values({ id, organizationId: organization.id, name: input.name, slug, description: input.description ?? null, ownerId: viewer.id, isTemplate: input.isTemplate ?? false, status: "DRAFT" });
    await tx.insert(agentVersions).values({ id: identifier(), agentId: id, version: 1, systemPrompt: input.systemPrompt, providerKey: input.providerKey, model: input.model, memoryConfig: { modules: ["ConversationMemory", "WorkingMemory", "LongTermMemory", "EpisodicMemory", "SemanticMemory"] }, permissions: [], capabilities: input.capabilities, createdBy: viewer.id });
  });
  await appendEvent({ organizationId: organization.id, type: "agent.created", aggregateId: id, payload: { name: input.name, version: 1 } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "agent.create", entityType: "agent", entityId: id });
  return { id };
}

export async function activateAgent(viewer: Viewer, agentId: string, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  await db.update(agentDefinitions).set({ status }).where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organization.id)));
  await appendEvent({ organizationId: organization.id, type: status === "ACTIVE" ? "agent.activated" : "agent.updated", aggregateId: agentId, payload: { status } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "agent.update", entityType: "agent", entityId: agentId, metadata: { status } });
}

export async function listAgentVersions(viewer: Viewer, agentId: string) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const agent = await db.select({ id: agentDefinitions.id }).from(agentDefinitions).where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organization.id))).limit(1);
  if (!agent[0]) throw new Error("Agent not found.");
  return db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version));
}

export async function createAgentVersion(viewer: Viewer, agentId: string, input: { systemPrompt: string; providerKey: string; model: string; capabilities: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const current = await db.select().from(agentDefinitions).where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organization.id))).limit(1);
  if (!current[0]) throw new Error("Agent not found.");
  const version = current[0].currentVersion + 1;
  await db.transaction(async tx => {
    await tx.insert(agentVersions).values({ id: identifier(), agentId, version, systemPrompt: input.systemPrompt, providerKey: input.providerKey, model: input.model, memoryConfig: { modules: ["ConversationMemory", "WorkingMemory", "LongTermMemory", "EpisodicMemory", "SemanticMemory"] }, permissions: [], capabilities: input.capabilities, createdBy: viewer.id });
    await tx.update(agentDefinitions).set({ currentVersion: version }).where(eq(agentDefinitions.id, agentId));
  });
  await appendEvent({ organizationId: organization.id, type: "agent.versioned", aggregateId: agentId, payload: { version } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "agent.version.create", entityType: "agent", entityId: agentId, metadata: { version } });
  return { version };
}

export async function listAgentTeams(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(agentTeams).where(eq(agentTeams.organizationId, organization.id)).orderBy(desc(agentTeams.updatedAt));
}

export async function createAgentTeam(viewer: Viewer, input: { name: string; description?: string; supervisorAgentId?: string; agentIds: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const uniqueAgentIds = Array.from(new Set(input.agentIds));
  if (input.supervisorAgentId && !uniqueAgentIds.includes(input.supervisorAgentId)) uniqueAgentIds.push(input.supervisorAgentId);
  if (uniqueAgentIds.length) {
    const records = await db.select({ id: agentDefinitions.id }).from(agentDefinitions).where(and(eq(agentDefinitions.organizationId, organization.id), inArray(agentDefinitions.id, uniqueAgentIds)));
    if (records.length !== uniqueAgentIds.length) throw new Error("Every team member must belong to this workspace.");
  }
  const id = identifier();
  await db.transaction(async tx => {
    await tx.insert(agentTeams).values({ id, organizationId: organization.id, name: input.name, description: input.description ?? null, supervisorAgentId: input.supervisorAgentId ?? null });
    if (uniqueAgentIds.length) await tx.insert(agentTeamMembers).values(uniqueAgentIds.map(agentId => ({ teamId: id, agentId, role: agentId === input.supervisorAgentId ? "SUPERVISOR" as const : "MEMBER" as const })));
  });
  await appendEvent({ organizationId: organization.id, type: "agent.team_created", aggregateId: id, payload: { name: input.name, memberCount: uniqueAgentIds.length } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "agent.team.create", entityType: "agent_team", entityId: id });
  return { id };
}

export async function assignToolToAgent(viewer: Viewer, input: { agentId: string; toolId: string; allowed: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const [agent, tool] = await Promise.all([
    db.select({ id: agentDefinitions.id }).from(agentDefinitions).where(and(eq(agentDefinitions.id, input.agentId), eq(agentDefinitions.organizationId, organization.id))).limit(1),
    db.select({ id: tools.id }).from(tools).where(and(eq(tools.id, input.toolId), eq(tools.organizationId, organization.id))).limit(1),
  ]);
  if (!agent[0] || !tool[0]) throw new Error("Agent or tool not found in this workspace.");
  await db.insert(agentTools).values({ agentId: input.agentId, toolId: input.toolId, allowed: input.allowed }).onDuplicateKeyUpdate({ set: { allowed: input.allowed } });
  await appendEvent({ organizationId: organization.id, type: "tool.assigned", aggregateId: input.toolId, payload: { agentId: input.agentId, allowed: input.allowed } });
}

export async function listTasks(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select({ task: tasks, agentName: agentDefinitions.name }).from(tasks).leftJoin(agentDefinitions, eq(tasks.assignedAgentId, agentDefinitions.id)).where(eq(tasks.organizationId, organization.id)).orderBy(desc(tasks.createdAt)).limit(50);
}

export async function createTask(viewer: Viewer, input: { title: string; instructions: string; assignedAgentId?: string; priority: TaskPriority; parentTaskId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const id = identifier();
  await db.insert(tasks).values({ id, organizationId: organization.id, title: input.title, input: { instructions: input.instructions }, assignedAgentId: input.assignedAgentId ?? null, priority: input.priority, parentTaskId: input.parentTaskId ?? null, createdBy: viewer.id, status: "PENDING" });
  await appendEvent({ organizationId: organization.id, type: "task.created", aggregateId: id, payload: { title: input.title, priority: input.priority } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "task.create", entityType: "task", entityId: id });
  return { id, status: "PENDING" as const };
}

export async function transitionTask(viewer: Viewer, taskId: string, nextStatus: TaskStatus) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const current = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organization.id))).limit(1);
  if (!current[0]) throw new Error("Task not found.");
  assertTaskTransition(current[0].status, nextStatus);
  const timestamps: { startedAt?: Date; completedAt?: Date; cancelledAt?: Date } = {};
  if (nextStatus === "RUNNING") timestamps.startedAt = new Date();
  if (["COMPLETED", "FAILED"].includes(nextStatus)) timestamps.completedAt = new Date();
  if (nextStatus === "CANCELLED") timestamps.cancelledAt = new Date();
  await db.update(tasks).set({ status: nextStatus, ...timestamps }).where(eq(tasks.id, taskId));
  await appendEvent({ organizationId: organization.id, type: nextStatus === "COMPLETED" ? "task.completed" : nextStatus === "FAILED" ? "task.failed" : "task.updated", aggregateId: taskId, payload: { from: current[0].status, to: nextStatus } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "task.transition", entityType: "task", entityId: taskId, metadata: { from: current[0].status, to: nextStatus } });
}

export async function runAgent(viewer: Viewer, agentId: string, input: { title: string; instructions: string; priority: TaskPriority }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const agent = await db.select().from(agentDefinitions).where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organization.id), eq(agentDefinitions.status, "ACTIVE"))).limit(1);
  if (!agent[0]) throw new Error("Only active agents can receive a run request.");
  const taskId = identifier();
  const jobId = identifier();
  await db.transaction(async tx => {
    await tx.insert(tasks).values({ id: taskId, organizationId: organization.id, title: input.title, input: { instructions: input.instructions }, assignedAgentId: agentId, priority: input.priority, createdBy: viewer.id, status: "QUEUED" });
    await tx.insert(jobs).values({ id: jobId, organizationId: organization.id, type: "agent.execute", payload: { taskId, agentId }, status: "QUEUED" });
    await tx.insert(taskExecutions).values({ id: identifier(), taskId, agentId, status: "QUEUED", trace: [{ type: "task.queued", message: "Awaiting a configured runtime adapter." }] });
  });
  await appendEvent({ organizationId: organization.id, type: "agent.started", aggregateId: agentId, payload: { taskId, jobId } });
  await appendEvent({ organizationId: organization.id, type: "task.queued", aggregateId: taskId, payload: { agentId, jobId } });
  return { taskId, jobId, status: "QUEUED" as const };
}

export async function retryTask(viewer: Viewer, taskId: string) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const original = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organization.id))).limit(1);
  if (!original[0] || !["FAILED", "CANCELLED"].includes(original[0].status)) throw new Error("Only failed or cancelled tasks can be retried.");
  const id = identifier();
  await db.transaction(async tx => {
    await tx.insert(tasks).values({ id, organizationId: organization.id, projectId: original[0]!.projectId, parentTaskId: taskId, assignedAgentId: original[0]!.assignedAgentId, createdBy: viewer.id, title: `Retry: ${original[0]!.title}`, input: original[0]!.input, priority: original[0]!.priority, status: "QUEUED" });
    await tx.insert(jobs).values({ id: identifier(), organizationId: organization.id, type: "task.execute", payload: { taskId: id, retryOf: taskId }, status: "QUEUED" });
  });
  await appendEvent({ organizationId: organization.id, type: "task.retried", aggregateId: id, payload: { retryOf: taskId } });
  return { id, status: "QUEUED" as const };
}

export async function requestApproval(viewer: Viewer, input: { taskId: string; actionType: string; summary: string }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const task = await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.organizationId, organization.id))).limit(1);
  if (!task[0] || !["RUNNING", "WAITING"].includes(task[0].status)) throw new Error("Only active or waiting tasks can request an approval.");
  const id = identifier();
  await db.transaction(async tx => {
    await tx.update(tasks).set({ status: "REQUIRES_APPROVAL" }).where(eq(tasks.id, input.taskId));
    await tx.insert(approvals).values({ id, organizationId: organization.id, taskId: input.taskId, requestedByAgentId: task[0]!.assignedAgentId, actionType: input.actionType, summary: input.summary, payload: {} });
  });
  await appendEvent({ organizationId: organization.id, type: "approval.requested", aggregateId: id, payload: { taskId: input.taskId, actionType: input.actionType } });
  return { id, status: "REQUIRES_APPROVAL" as const };
}

export async function listWorkflows(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(workflows).where(eq(workflows.organizationId, organization.id)).orderBy(desc(workflows.updatedAt));
}

export async function createWorkflow(viewer: Viewer, input: { name: string; description?: string; definition: WorkflowDefinition }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const workflowId = identifier();
  const versionId = identifier();
  await db.transaction(async tx => {
    await tx.insert(workflows).values({ id: workflowId, organizationId: organization.id, name: input.name, description: input.description ?? null, createdBy: viewer.id });
    await tx.insert(workflowVersions).values({ id: versionId, workflowId, version: 1, definition: input.definition as unknown as Record<string, unknown>, createdBy: viewer.id });
    if (input.definition.nodes.length) {
      await tx.insert(workflowNodes).values(input.definition.nodes.map(node => ({ id: identifier(), workflowVersionId: versionId, nodeKey: node.id, type: node.type, name: node.name, config: node.config })));
    }
  });
  await appendEvent({ organizationId: organization.id, type: "workflow.created", aggregateId: workflowId, payload: { name: input.name, version: 1 } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "workflow.create", entityType: "workflow", entityId: workflowId });
  return { id: workflowId };
}

export async function listTools(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(tools).where(eq(tools.organizationId, organization.id)).orderBy(desc(tools.updatedAt));
}

export async function createTool(viewer: Viewer, input: { name: string; description?: string; kind: "BUILT_IN" | "HTTP" | "MCP" | "CODE" | "EXTERNAL"; requiredCapabilities: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const id = identifier();
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "tool"}-${id.slice(-5)}`;
  await db.transaction(async tx => {
    await tx.insert(tools).values({ id, organizationId: organization.id, name: input.name, slug, description: input.description ?? null, kind: input.kind, createdBy: viewer.id });
    await tx.insert(toolVersions).values({ id: identifier(), toolId: id, version: 1, inputSchema: { type: "object" }, outputSchema: { type: "object" }, requiredCapabilities: input.requiredCapabilities, runtimeConfig: { execution: "adapter_required" } });
  });
  await appendEvent({ organizationId: organization.id, type: "tool.created", aggregateId: id, payload: { name: input.name, kind: input.kind } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "tool.create", entityType: "tool", entityId: id });
  return { id };
}

export async function createWorkflowVersion(viewer: Viewer, workflowId: string, definition: WorkflowDefinition) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const workflow = await db.select().from(workflows).where(and(eq(workflows.id, workflowId), eq(workflows.organizationId, organization.id))).limit(1);
  if (!workflow[0]) throw new Error("Workflow not found.");
  const nodeKeys = definition.nodes.map(node => node.id);
  if (new Set(nodeKeys).size !== nodeKeys.length) throw new Error("Workflow node identifiers must be unique.");
  if (!definition.nodes.some(node => node.type === "TRIGGER")) throw new Error("Every workflow requires a trigger node.");
  if (definition.edges.some(edge => !nodeKeys.includes(edge.source) || !nodeKeys.includes(edge.target))) throw new Error("Every workflow edge must reference declared nodes.");
  const version = workflow[0].currentVersion + 1;
  const versionId = identifier();
  await db.transaction(async tx => {
    await tx.insert(workflowVersions).values({ id: versionId, workflowId, version, definition: definition as unknown as Record<string, unknown>, createdBy: viewer.id });
    if (definition.nodes.length) await tx.insert(workflowNodes).values(definition.nodes.map(node => ({ id: identifier(), workflowVersionId: versionId, nodeKey: node.id, type: node.type, name: node.name, config: node.config })));
    await tx.update(workflows).set({ currentVersion: version }).where(eq(workflows.id, workflowId));
  });
  await appendEvent({ organizationId: organization.id, type: "workflow.versioned", aggregateId: workflowId, payload: { version, nodeCount: definition.nodes.length } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "workflow.version.create", entityType: "workflow", entityId: workflowId, metadata: { version } });
  return { version };
}

export async function listApprovals(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select({ approval: approvals, taskTitle: tasks.title }).from(approvals).innerJoin(tasks, eq(approvals.taskId, tasks.id)).where(eq(approvals.organizationId, organization.id)).orderBy(desc(approvals.createdAt));
}

export async function resolveApproval(viewer: Viewer, approvalId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const record = await db.select().from(approvals).where(and(eq(approvals.id, approvalId), eq(approvals.organizationId, organization.id), eq(approvals.status, "PENDING"))).limit(1);
  if (!record[0]) throw new Error("Pending approval not found.");
  await db.transaction(async tx => {
    await tx.update(approvals).set({ status: decision, resolutionNote: note ?? null, resolvedBy: viewer.id, resolvedAt: new Date() }).where(eq(approvals.id, approvalId));
    await tx.update(tasks).set({ status: decision === "APPROVED" ? "QUEUED" : "CANCELLED", cancelledAt: decision === "REJECTED" ? new Date() : null }).where(eq(tasks.id, record[0].taskId));
  });
  await appendEvent({ organizationId: organization.id, type: "approval.completed", aggregateId: approvalId, payload: { decision, taskId: record[0].taskId } });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "approval.resolve", entityType: "approval", entityId: approvalId, metadata: { decision } });
}

export async function listMemory(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(memories).where(eq(memories.organizationId, organization.id)).orderBy(desc(memories.createdAt));
}

export async function listRuns(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select({ execution: taskExecutions, taskTitle: tasks.title, taskStatus: tasks.status, parentTaskId: tasks.parentTaskId, agentName: agentDefinitions.name }).from(taskExecutions).innerJoin(tasks, eq(taskExecutions.taskId, tasks.id)).leftJoin(agentDefinitions, eq(taskExecutions.agentId, agentDefinitions.id)).where(eq(tasks.organizationId, organization.id)).orderBy(desc(taskExecutions.createdAt)).limit(50);
}

export async function listArtifacts(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select({ artifact: artifacts, taskTitle: tasks.title }).from(artifacts).leftJoin(tasks, eq(artifacts.taskId, tasks.id)).where(eq(artifacts.organizationId, organization.id)).orderBy(desc(artifacts.createdAt)).limit(50);
}

export async function listJobs(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select().from(jobs).where(eq(jobs.organizationId, organization.id)).orderBy(desc(jobs.createdAt)).limit(50);
}

export async function listApiKeys(viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  return db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scopes: apiKeys.scopes, lastUsedAt: apiKeys.lastUsedAt, expiresAt: apiKeys.expiresAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.organizationId, organization.id)).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(viewer: Viewer, input: { name: string; scopes: string[]; expiresAt?: Date }) {
  if (viewer.role !== "admin") throw new Error("Only workspace administrators can issue API keys.");
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const secret = randomBytes(32).toString("base64url");
  const prefix = `agos_${secret.slice(0, 8)}`;
  const token = `${prefix}_${secret.slice(8)}`;
  const id = identifier();
  await db.insert(apiKeys).values({ id, organizationId: organization.id, name: input.name, prefix, hashedSecret: createHash("sha256").update(token).digest("hex"), scopes: input.scopes, expiresAt: input.expiresAt ?? null, createdBy: viewer.id });
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "api_key.create", entityType: "api_key", entityId: id, metadata: { name: input.name, scopes: input.scopes } });
  return { id, token, prefix };
}

export async function revokeApiKey(viewer: Viewer, id: string) {
  if (viewer.role !== "admin") throw new Error("Only workspace administrators can revoke API keys.");
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organization.id)));
  await audit({ organizationId: organization.id, actorUserId: viewer.id, action: "api_key.revoke", entityType: "api_key", entityId: id });
}

export async function listAuditLogs(viewer: Viewer, query?: string) {
  const db = await getDb();
  if (!db) throw new Error("AgentOS storage is not available.");
  const { organization } = await getWorkspace(viewer);
  const entries = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, organization.id)).orderBy(desc(auditLogs.createdAt)).limit(100);
  const normalized = query?.trim().toLowerCase();
  return normalized ? entries.filter(entry => `${entry.action} ${entry.entityType} ${entry.entityId ?? ""}`.toLowerCase().includes(normalized)) : entries;
}
