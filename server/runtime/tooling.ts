export type ToolInvocation = {
  organizationId: number;
  toolId: string;
  input: Record<string, unknown>;
  timeoutMs: number;
};

export type ToolResult = { output: Record<string, unknown>; metadata?: Record<string, unknown> };

export interface ToolRuntime {
  invoke(invocation: ToolInvocation): Promise<ToolResult>;
}

export interface McpToolDiscoveryAdapter {
  discover(connection: { endpoint?: string; transport: "STDIO" | "SSE" | "HTTP"; config: Record<string, unknown> }): Promise<Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>>;
}

export interface CodeExecutor {
  execute(input: { code: string; language: "typescript" | "javascript" | "python"; stdin?: string; timeoutMs: number }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export class DisabledCodeExecutor implements CodeExecutor {
  async execute(_input: { code: string; language: "typescript" | "javascript" | "python"; stdin?: string; timeoutMs: number }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    throw new Error("Code execution requires a sandboxed CodeExecutor runtime adapter.");
  }
}
