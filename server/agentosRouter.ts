import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  activateAgent,
  assignToolToAgent,
  createAgentTeam,
  createAgentVersion,
  createApiKey,
  createAgent,
  createTask,
  createTool,
  createWorkflow,
  createWorkflowVersion,
  getDashboard,
  listAgentTeams,
  listAgentVersions,
  listArtifacts,
  listApiKeys,
  listAuditLogs,
  listJobs,
  listAgents,
  listApprovals,
  listMemory,
  listRuns,
  listTasks,
  listTools,
  listWorkflows,
  resolveApproval,
  revokeApiKey,
  requestApproval,
  retryTask,
  runAgent,
  transitionTask,
} from "./agentosDb";
import { protectedProcedure, router } from "./_core/trpc";

const taskStatusSchema = z.enum(["PENDING", "QUEUED", "RUNNING", "WAITING", "BLOCKED", "REQUIRES_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"]);
const capabilitySchema = z.enum(["web.search", "web.scrape", "database.read", "database.write", "filesystem.read", "filesystem.write", "email.send", "calendar.read", "calendar.write", "code.execute", "browser.use", "agent.delegate", "workflow.create", "workflow.execute"]);
const viewer = (user: { id: number; name: string | null; role: "user" | "admin" }) => user;

const asProcedureError = <T>(operation: () => Promise<T>) => operation().catch(error => {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "AgentOS request failed." });
});

export const agentosRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => asProcedureError(() => getDashboard(viewer(ctx.user)))),
  agents: router({
    list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listAgents(viewer(ctx.user)))),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), description: z.string().max(2000).optional(), systemPrompt: z.string().min(20).max(12000), providerKey: z.string().min(2).max(80), model: z.string().min(2).max(160), capabilities: z.array(capabilitySchema).max(20), isTemplate: z.boolean().optional() })).mutation(({ ctx, input }) => asProcedureError(() => createAgent(viewer(ctx.user), input))),
    setStatus: protectedProcedure.input(z.object({ agentId: z.string().min(6), status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]) })).mutation(({ ctx, input }) => asProcedureError(() => activateAgent(viewer(ctx.user), input.agentId, input.status))),
    run: protectedProcedure.input(z.object({ agentId: z.string().min(6), title: z.string().min(2).max(240), instructions: z.string().min(1).max(20000), priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL") })).mutation(({ ctx, input }) => asProcedureError(() => runAgent(viewer(ctx.user), input.agentId, input))),
    versions: protectedProcedure.input(z.object({ agentId: z.string().min(6) })).query(({ ctx, input }) => asProcedureError(() => listAgentVersions(viewer(ctx.user), input.agentId))),
    createVersion: protectedProcedure.input(z.object({ agentId: z.string().min(6), systemPrompt: z.string().min(20).max(12000), providerKey: z.string().min(2).max(80), model: z.string().min(2).max(160), capabilities: z.array(capabilitySchema).max(20) })).mutation(({ ctx, input }) => asProcedureError(() => createAgentVersion(viewer(ctx.user), input.agentId, input))),
    teams: router({ list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listAgentTeams(viewer(ctx.user)))), create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), description: z.string().max(2000).optional(), supervisorAgentId: z.string().min(6).optional(), agentIds: z.array(z.string().min(6)).max(50) })).mutation(({ ctx, input }) => asProcedureError(() => createAgentTeam(viewer(ctx.user), input))) }),
  }),
  tasks: router({
    list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listTasks(viewer(ctx.user)))),
    create: protectedProcedure.input(z.object({ title: z.string().min(2).max(240), instructions: z.string().min(1).max(20000), assignedAgentId: z.string().min(6).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"), parentTaskId: z.string().min(6).optional() })).mutation(({ ctx, input }) => asProcedureError(() => createTask(viewer(ctx.user), input))),
    transition: protectedProcedure.input(z.object({ taskId: z.string().min(6), status: taskStatusSchema })).mutation(({ ctx, input }) => asProcedureError(() => transitionTask(viewer(ctx.user), input.taskId, input.status))),
    retry: protectedProcedure.input(z.object({ taskId: z.string().min(6) })).mutation(({ ctx, input }) => asProcedureError(() => retryTask(viewer(ctx.user), input.taskId))),
    requestApproval: protectedProcedure.input(z.object({ taskId: z.string().min(6), actionType: z.string().min(2).max(160), summary: z.string().min(2).max(5000) })).mutation(({ ctx, input }) => asProcedureError(() => requestApproval(viewer(ctx.user), input))),
  }),
  workflows: router({
    list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listWorkflows(viewer(ctx.user)))),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), description: z.string().max(2000).optional(), definition: z.object({ version: z.literal(1), nodes: z.array(z.object({ id: z.string().min(1).max(100), type: z.enum(["TRIGGER", "AGENT", "TOOL", "CONDITION", "APPROVAL", "LOOP", "OUTPUT"]), name: z.string().min(1).max(160), config: z.record(z.string(), z.unknown()), next: z.array(z.string()).optional() })), edges: z.array(z.object({ source: z.string(), target: z.string(), condition: z.string().optional() })) }) })).mutation(({ ctx, input }) => asProcedureError(() => createWorkflow(viewer(ctx.user), input))),
    createVersion: protectedProcedure.input(z.object({ workflowId: z.string().min(6), definition: z.object({ version: z.literal(1), nodes: z.array(z.object({ id: z.string().min(1).max(100), type: z.enum(["TRIGGER", "AGENT", "TOOL", "CONDITION", "APPROVAL", "LOOP", "OUTPUT"]), name: z.string().min(1).max(160), config: z.record(z.string(), z.unknown()), next: z.array(z.string()).optional() })), edges: z.array(z.object({ source: z.string(), target: z.string(), condition: z.string().optional() })) }) })).mutation(({ ctx, input }) => asProcedureError(() => createWorkflowVersion(viewer(ctx.user), input.workflowId, input.definition))),
  }),
  tools: router({
    list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listTools(viewer(ctx.user)))),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), description: z.string().max(2000).optional(), kind: z.enum(["BUILT_IN", "HTTP", "MCP", "CODE", "EXTERNAL"]), requiredCapabilities: z.array(capabilitySchema).max(20) })).mutation(({ ctx, input }) => asProcedureError(() => createTool(viewer(ctx.user), input))),
    assign: protectedProcedure.input(z.object({ agentId: z.string().min(6), toolId: z.string().min(6), allowed: z.boolean() })).mutation(({ ctx, input }) => asProcedureError(() => assignToolToAgent(viewer(ctx.user), input))),
  }),
  memory: router({ list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listMemory(viewer(ctx.user)))) }),
  approvals: router({
    list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listApprovals(viewer(ctx.user)))),
    resolve: protectedProcedure.input(z.object({ approvalId: z.string().min(6), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(1000).optional() })).mutation(({ ctx, input }) => asProcedureError(() => resolveApproval(viewer(ctx.user), input.approvalId, input.decision, input.note))),
  }),
  governance: router({
    apiKeys: router({
      list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listApiKeys(viewer(ctx.user)))),
      create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), scopes: z.array(z.string().min(2).max(120)).min(1).max(20) })).mutation(({ ctx, input }) => asProcedureError(() => createApiKey(viewer(ctx.user), input))),
      revoke: protectedProcedure.input(z.object({ id: z.string().min(6) })).mutation(({ ctx, input }) => asProcedureError(() => revokeApiKey(viewer(ctx.user), input.id))),
    }),
    audit: protectedProcedure.input(z.object({ query: z.string().max(120).optional() }).optional()).query(({ ctx, input }) => asProcedureError(() => listAuditLogs(viewer(ctx.user), input?.query))),
  }),
  runs: router({ list: protectedProcedure.query(({ ctx }) => asProcedureError(() => listRuns(viewer(ctx.user)))), jobs: protectedProcedure.query(({ ctx }) => asProcedureError(() => listJobs(viewer(ctx.user)))), artifacts: protectedProcedure.query(({ ctx }) => asProcedureError(() => listArtifacts(viewer(ctx.user)))) }),
});
