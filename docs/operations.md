# AgentOS Operations Guide

## Deployment boundary

The managed web application hosts the **control plane**: authenticated dashboard, typed APIs, relational state, audit records, and user-initiated control actions. It must not consume jobs, execute agents, maintain event loops, or run scheduled work in the request process.

Deploy a separate runtime worker for execution. The worker implements the `JobQueue`, `EventBus`, `LlmProvider`, `ToolRuntime`, `CodeExecutor`, `Scheduler`, cache, object-storage, and vector-store interfaces. It claims durable `jobs` records and posts state transitions, traces, artifacts, usage, and events back through the control-plane contract.

## Runbook

1. Provision relational storage and run the reviewed Drizzle migration.
2. Deploy the web/API control plane with OAuth and database configuration.
3. Deploy the worker with queue, cache, object-store, vector-store, and secrets-vault adapters.
4. Register schedules through the external scheduler, storing its opaque task identifier in `workflows.scheduleCronTaskUid`.
5. Monitor queue lag, failed jobs, error traces, approval backlog, and usage ceilings.

> The in-memory adapters exist only to exercise the contract in development. They are intentionally unsuitable for multi-instance or durable execution.
