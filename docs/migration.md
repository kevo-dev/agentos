# AgentOS Migration Guide

## Initial schema

The initial AgentOS migration creates tenant workspace records, agent and tool version registries, task and workflow execution state, approvals, memory references, event records, jobs, usage, and audit logs. It was generated from `drizzle/schema.ts` and reconciled with the Drizzle migration ledger after database verification.

## Upgrade procedure

1. Update `drizzle/schema.ts`; retain additive changes where possible.
2. Run `pnpm drizzle-kit generate`, then inspect the generated SQL before execution.
3. Apply the reviewed migration through the managed database migration workflow.
4. Verify table and index state with a read-only schema query.
5. Deploy code compatible with both the old and new shape before relying on new columns.

> Avoid destructive table changes for task, workflow, audit, trace, artifact, or memory records without a recovery plan.
