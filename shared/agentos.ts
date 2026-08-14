/**
 * Provider-neutral contracts for AgentOS. Concrete implementations stay in
 * server/services so the control plane can migrate independently from runtime
 * infrastructure.
 */

export const TASK_STATUSES = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "WAITING",
  "BLOCKED",
  "REQUIRES_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type MemoryModuleName =
  | "ConversationMemory"
  | "WorkingMemory"
  | "LongTermMemory"
  | "EpisodicMemory"
  | "SemanticMemory";

export type AgentRunStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
export type JobStatus = "QUEUED" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type Capability =
  | "web.search"
  | "web.scrape"
  | "database.read"
  | "database.write"
  | "filesystem.read"
  | "filesystem.write"
  | "email.send"
  | "calendar.read"
  | "calendar.write"
  | "code.execute"
  | "browser.use"
  | "agent.delegate"
  | "workflow.create"
  | "workflow.execute";

export type EventNamespace =
  | `agent.${string}`
  | `task.${string}`
  | `tool.${string}`
  | `workflow.${string}`
  | `approval.${string}`;

export interface AgentInput {
  taskId: string;
  organizationId: number;
  input: Record<string, unknown>;
  conversationId?: string;
  parentRunId?: string;
}

export interface AgentResult {
  status: "COMPLETED" | "FAILED" | "WAITING" | "REQUIRES_APPROVAL";
  output?: Record<string, unknown>;
  artifacts?: Array<{ name: string; mediaType: string; url?: string }>;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  error?: { code: string; message: string };
}

export interface ToolContext {
  organizationId: number;
  agentId: string;
  taskId: string;
  grantedCapabilities: Capability[];
  traceId: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  requiredCapabilities: Capability[];
  inputSchema: unknown;
  outputSchema: unknown;
  execute(input: unknown, context: ToolContext): Promise<{ output: unknown; artifacts?: string[] }>;
}

export interface AgentRuntimeAdapter {
  execute(agentId: string, input: AgentInput): Promise<AgentResult>;
  cancel(runId: string): Promise<void>;
}

export interface ToolRuntimeAdapter {
  execute(tool: Tool, input: unknown, context: ToolContext): Promise<{ output: unknown; artifacts?: string[] }>;
}

export interface CodeExecutionRequest {
  language: string;
  source: string;
  timeoutMs: number;
  memoryLimitMb: number;
}

export interface CodeExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
}

/** The CodeExecutor interface deliberately has no host-shell implementation. */
export interface CodeExecutor {
  execute(input: CodeExecutionRequest): Promise<CodeExecutionResult>;
}

export interface DatabaseAdapter {
  health(): Promise<{ healthy: boolean; latencyMs?: number }>;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface VectorStoreAdapter {
  upsert(input: { id: string; vector: number[]; metadata: Record<string, unknown> }): Promise<void>;
  query(input: { vector: number[]; limit: number; filter?: Record<string, unknown> }): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>>;
  delete(id: string): Promise<void>;
}

export interface ObjectStorageAdapter {
  put(input: { key: string; data: Uint8Array; contentType: string }): Promise<{ key: string; url: string }>;
  getUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface JobQueue {
  enqueue(job: { id: string; type: string; payload: Record<string, unknown> }): Promise<void>;
  consume(handler: (job: { id: string; type: string; payload: Record<string, unknown> }) => Promise<void>): Promise<void>;
  retry(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
}

export interface QueueAdapter extends JobQueue {}

export interface SchedulerAdapter {
  schedule(input: { id: string; cron: string; payload: Record<string, unknown> }): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  unschedule(id: string): Promise<void>;
}

export interface LLMProviderAdapter {
  generate(input: { model: string; messages: Array<{ role: string; content: string }>; responseSchema?: unknown }): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }>;
  stream(input: { model: string; messages: Array<{ role: string; content: string }> }): AsyncIterable<string>;
  embed(input: { model: string; values: string[] }): Promise<number[][]>;
}

export interface AgentEvent {
  id: string;
  type: EventNamespace;
  organizationId: number;
  occurredAt: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
}

export interface EventBus {
  publish(event: AgentEvent): Promise<void>;
  subscribe(type: EventNamespace, handler: (event: AgentEvent) => Promise<void>): () => void;
}

export interface WorkflowNodeDefinition {
  id: string;
  type: "TRIGGER" | "AGENT" | "TOOL" | "CONDITION" | "APPROVAL" | "LOOP" | "OUTPUT";
  name: string;
  config: Record<string, unknown>;
  next?: string[];
}

export interface WorkflowDefinition {
  version: 1;
  nodes: WorkflowNodeDefinition[];
  edges: Array<{ source: string; target: string; condition?: string }>;
}

export interface MemoryManager {
  write(module: MemoryModuleName, entry: { scope: string; content: string; metadata?: Record<string, unknown> }): Promise<void>;
  search(module: MemoryModuleName, query: string, limit?: number): Promise<Array<{ id: string; content: string; score?: number }>>;
  forget(module: MemoryModuleName, id: string): Promise<void>;
}
