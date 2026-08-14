# AgentOS Architecture

AgentOS is implemented as a **control plane** that records configuration, ownership, governance, execution state, and audit data. Execution work is intentionally represented behind runtime interfaces. This keeps the initial application operational on the managed platform while allowing the web/API plane to migrate to a Vercel-compatible deployment and the runtime plane to move independently.

| Boundary | Initial implementation | Future-compatible target | Contract |
| --- | --- | --- | --- |
| Web and API | React, Express, tRPC, Zod | Next.js, Route Handlers, typed RPC or REST | UI calls typed control-plane procedures only |
| Relational state | Drizzle over MySQL-compatible storage | PostgreSQL with a Drizzle dialect migration | `DatabaseAdapter` and repository operations |
| Job dispatch | Persisted jobs and an interface-owned queue seam | Redis/BullMQ, managed queue, or durable workflow runtime | `JobQueue` / `QueueAdapter` |
| Schedules | Platform-managed HTTP schedules | Vercel Cron or external scheduler | `SchedulerAdapter` |
| Artifacts | Object-storage references only | Vercel Blob or S3-compatible service | `ObjectStorageAdapter` |
| Semantic memory | Durable metadata with a vector-store seam | pgvector, Pinecone, or another vector database | `VectorStoreAdapter` |
| LLM access | Provider-neutral runtime interface | OpenAI, Anthropic, Google, local, or other providers | `LLMProviderAdapter` |
| Tools and remote agents | Versioned catalog and adapter boundaries | MCP, HTTP, webhooks, remote workers, AgentOS peers | `ToolRuntimeAdapter` / `AgentRuntimeAdapter` |

## Execution and safety model

The control plane receives commands, validates each payload, evaluates tenant membership and least-privilege grants, and creates durable task and job records. A worker implementation consumes jobs independently of the HTTP request lifecycle. The managed deployment initially exposes the **contract and persisted lifecycle**; long-running production workers must run on an external durable runtime or an always-on service rather than inside a request handler.

The `CodeExecutor` interface has no unrestricted host implementation. Production implementations must use an isolated container, microVM, or sandbox worker and apply an allowlist of languages, resource limits, network policy, and output limits.

## Scheduled workflows

Scheduled workflows are stored as structured workflow definitions plus scheduler metadata. Platform HTTP schedules authenticate the schedule identity, look up the workflow by the durable schedule identifier, and enqueue an idempotent execution request. This avoids in-process timers and separates schedule invocation from execution.

## Security boundaries

Each business entity carries an organization scope, and repository procedures filter by that scope. Agent capabilities are explicit grants, tools declare their required capabilities, and approval-gated actions produce immutable audit records. Secrets are represented only by masked metadata and external key references; they are never returned to the browser. Runtime input is schema-validated and stored separately from execution traces to reduce prompt-injection propagation.

## Initial operating profile

The initial control plane is fully usable for managing agents, tasks, workflows, tools, memory entries, approvals, and run records. Provider-specific AI calls, MCP connections, and arbitrary code execution remain disabled until a corresponding adapter is configured. This is intentional: a registry entry is not permission to execute a sensitive external action.
