import type { CodeExecutor, ToolRuntime } from "./tooling";

export interface LlmProvider {
  complete(input: { model: string; systemPrompt: string; messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>; responseSchema?: Record<string, unknown> }): Promise<{ content: string; inputTokens: number; outputTokens: number; estimatedCostMicros: number }>;
}

export interface AgentRuntime {
  execute(input: { taskId: string; agentId: string; instructions: string }): Promise<{ output: Record<string, unknown>; trace: Array<Record<string, unknown>> }>;
}

export type RuntimeDependencies = { llm: LlmProvider; tools: ToolRuntime; codeExecutor: CodeExecutor };
