# AgentOS Security Guide

## Tenancy and access

All primary control-plane records carry an organization boundary and queries resolve the caller's workspace before acting. Organization membership supplies the role boundary; individual agents and tools persist scoped capability and permission configuration.

## Input and execution safeguards

Typed tRPC inputs enforce bounded data shapes. Prompt content is assessed for common injection instructions before use by a production runtime. Tool and code execution are interface boundaries rather than in-process features; a deployment must attach a sandboxed `CodeExecutor`, scoped `ToolRuntime`, encrypted `SecretVault`, and service-side API-key verifier.

## Audit and incident response

Agent, task, tool, workflow, and approval actions append durable events and audit entries. Retain audit records independently from active entities, review failed traces without exposing secrets, revoke API keys through the provider adapter, and pause active agents or workflows during incident containment.
