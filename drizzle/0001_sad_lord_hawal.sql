CREATE TABLE `agentDefinitions` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int,
	`name` varchar(160) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`description` text,
	`status` enum('DRAFT','ACTIVE','PAUSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`currentVersion` int NOT NULL DEFAULT 1,
	`ownerId` int NOT NULL,
	`isTemplate` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `agentDefinitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_org_slug` UNIQUE(`organizationId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `agentTeamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` varchar(36) NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`role` enum('SUPERVISOR','MEMBER') NOT NULL DEFAULT 'MEMBER',
	CONSTRAINT `agentTeamMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentTeamMembers_team_agent` UNIQUE(`teamId`,`agentId`)
);
--> statement-breakpoint
CREATE TABLE `agentTeams` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`supervisorAgentId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentTeams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentTools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`toolId` varchar(36) NOT NULL,
	`allowed` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentTools_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentTools_agent_tool` UNIQUE(`agentId`,`toolId`)
);
--> statement-breakpoint
CREATE TABLE `agentVersions` (
	`id` varchar(36) NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`systemPrompt` text NOT NULL,
	`providerKey` varchar(80) NOT NULL,
	`model` varchar(160) NOT NULL,
	`memoryConfig` json NOT NULL,
	`permissions` json NOT NULL,
	`capabilities` json NOT NULL,
	`outputSchema` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentVersions_agent_version` UNIQUE(`agentId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `apiKeys` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`hashedSecret` varchar(255) NOT NULL,
	`scopes` json NOT NULL,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiKeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`taskId` varchar(36) NOT NULL,
	`requestedByAgentId` varchar(36),
	`actionType` varchar(160) NOT NULL,
	`summary` text NOT NULL,
	`payload` json NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',
	`resolvedBy` int,
	`resolutionNote` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`taskId` varchar(36),
	`name` varchar(240) NOT NULL,
	`objectKey` varchar(512) NOT NULL,
	`mediaType` varchar(120) NOT NULL,
	`byteSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int,
	`action` varchar(160) NOT NULL,
	`entityType` varchar(120) NOT NULL,
	`entityId` varchar(36),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`taskId` varchar(36),
	`title` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventRecords` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`type` varchar(160) NOT NULL,
	`aggregateId` varchar(36),
	`payload` json NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `externalAgents` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`endpoint` varchar(2048) NOT NULL,
	`protocol` varchar(80) NOT NULL,
	`capabilities` json NOT NULL,
	`status` enum('DRAFT','ACTIVE','DISABLED','ERROR') NOT NULL DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `externalAgents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`kind` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('DRAFT','ACTIVE','DISABLED','ERROR') NOT NULL DEFAULT 'DRAFT',
	`config` json NOT NULL,
	`secretReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`type` varchar(120) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('QUEUED','RUNNING','RETRYING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`runAfter` timestamp NOT NULL DEFAULT (now()),
	`lockedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llmProviders` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`providerKey` varchar(80) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`status` enum('DRAFT','ACTIVE','DISABLED','ERROR') NOT NULL DEFAULT 'DRAFT',
	`secretReference` varchar(255),
	`config` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llmProviders_id` PRIMARY KEY(`id`),
	CONSTRAINT `llmProviders_org_key` UNIQUE(`organizationId`,`providerKey`)
);
--> statement-breakpoint
CREATE TABLE `mcpConnections` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`transport` enum('STDIO','SSE','HTTP') NOT NULL,
	`endpoint` varchar(2048),
	`status` enum('DRAFT','ACTIVE','DISABLED','ERROR') NOT NULL DEFAULT 'DRAFT',
	`config` json NOT NULL,
	`secretReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mcpConnections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`module` enum('ConversationMemory','WorkingMemory','LongTermMemory','EpisodicMemory','SemanticMemory') NOT NULL,
	`scope` varchar(160) NOT NULL,
	`config` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryEntries` (
	`id` varchar(36) NOT NULL,
	`memoryId` varchar(36) NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`embeddingRef` varchar(200),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`role` enum('SYSTEM','USER','ASSISTANT','TOOL') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('OWNER','ADMIN','OPERATOR','VIEWER') NOT NULL DEFAULT 'VIEWER',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizationMembers_org_user` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskExecutions` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(36) NOT NULL,
	`agentId` varchar(36),
	`status` enum('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`trace` json NOT NULL,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`estimatedCostMicros` int NOT NULL DEFAULT 0,
	`latencyMs` int,
	`error` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int,
	`parentTaskId` varchar(36),
	`assignedAgentId` varchar(36),
	`createdBy` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`input` json NOT NULL,
	`output` json,
	`status` enum('PENDING','QUEUED','RUNNING','WAITING','BLOCKED','REQUIRES_APPROVAL','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`priority` enum('LOW','NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
	`error` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`cancelledAt` timestamp,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `toolVersions` (
	`id` varchar(36) NOT NULL,
	`toolId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`inputSchema` json NOT NULL,
	`outputSchema` json NOT NULL,
	`requiredCapabilities` json NOT NULL,
	`runtimeConfig` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `toolVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `toolVersions_tool_version` UNIQUE(`toolId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`description` text,
	`kind` enum('BUILT_IN','HTTP','MCP','CODE','EXTERNAL') NOT NULL DEFAULT 'BUILT_IN',
	`status` enum('DRAFT','ACTIVE','DISABLED') NOT NULL DEFAULT 'DRAFT',
	`currentVersion` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `tools_org_slug` UNIQUE(`organizationId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `usageRecords` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`taskExecutionId` varchar(36),
	`providerKey` varchar(80) NOT NULL,
	`model` varchar(160) NOT NULL,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`estimatedCostMicros` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowExecutions` (
	`id` varchar(36) NOT NULL,
	`workflowId` varchar(36) NOT NULL,
	`taskId` varchar(36),
	`status` enum('QUEUED','RUNNING','WAITING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`trace` json NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflowExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowNodes` (
	`id` varchar(36) NOT NULL,
	`workflowVersionId` varchar(36) NOT NULL,
	`nodeKey` varchar(100) NOT NULL,
	`type` enum('TRIGGER','AGENT','TOOL','CONDITION','APPROVAL','LOOP','OUTPUT') NOT NULL,
	`name` varchar(160) NOT NULL,
	`config` json NOT NULL,
	CONSTRAINT `workflowNodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflowNodes_version_key` UNIQUE(`workflowVersionId`,`nodeKey`)
);
--> statement-breakpoint
CREATE TABLE `workflowVersions` (
	`id` varchar(36) NOT NULL,
	`workflowId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`definition` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflowVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflowVersions_workflow_version` UNIQUE(`workflowId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`projectId` int,
	`name` varchar(160) NOT NULL,
	`description` text,
	`status` enum('DRAFT','ACTIVE','PAUSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`currentVersion` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agentDefinitions` ADD CONSTRAINT `agentDefinitions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentDefinitions` ADD CONSTRAINT `agentDefinitions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentDefinitions` ADD CONSTRAINT `agentDefinitions_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTeamMembers` ADD CONSTRAINT `agentTeamMembers_teamId_agentTeams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `agentTeams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTeamMembers` ADD CONSTRAINT `agentTeamMembers_agentId_agentDefinitions_id_fk` FOREIGN KEY (`agentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTeams` ADD CONSTRAINT `agentTeams_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTeams` ADD CONSTRAINT `agentTeams_supervisorAgentId_agentDefinitions_id_fk` FOREIGN KEY (`supervisorAgentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTools` ADD CONSTRAINT `agentTools_agentId_agentDefinitions_id_fk` FOREIGN KEY (`agentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTools` ADD CONSTRAINT `agentTools_toolId_tools_id_fk` FOREIGN KEY (`toolId`) REFERENCES `tools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentVersions` ADD CONSTRAINT `agentVersions_agentId_agentDefinitions_id_fk` FOREIGN KEY (`agentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentVersions` ADD CONSTRAINT `agentVersions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `apiKeys` ADD CONSTRAINT `apiKeys_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `apiKeys` ADD CONSTRAINT `apiKeys_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_requestedByAgentId_agentDefinitions_id_fk` FOREIGN KEY (`requestedByAgentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_resolvedBy_users_id_fk` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eventRecords` ADD CONSTRAINT `eventRecords_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `externalAgents` ADD CONSTRAINT `externalAgents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `llmProviders` ADD CONSTRAINT `llmProviders_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mcpConnections` ADD CONSTRAINT `mcpConnections_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memories` ADD CONSTRAINT `memories_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memoryEntries` ADD CONSTRAINT `memoryEntries_memoryId_memories_id_fk` FOREIGN KEY (`memoryId`) REFERENCES `memories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationMembers` ADD CONSTRAINT `organizationMembers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationMembers` ADD CONSTRAINT `organizationMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskExecutions` ADD CONSTRAINT `taskExecutions_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskExecutions` ADD CONSTRAINT `taskExecutions_agentId_agentDefinitions_id_fk` FOREIGN KEY (`agentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignedAgentId_agentDefinitions_id_fk` FOREIGN KEY (`assignedAgentId`) REFERENCES `agentDefinitions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `toolVersions` ADD CONSTRAINT `toolVersions_toolId_tools_id_fk` FOREIGN KEY (`toolId`) REFERENCES `tools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tools` ADD CONSTRAINT `tools_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tools` ADD CONSTRAINT `tools_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usageRecords` ADD CONSTRAINT `usageRecords_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usageRecords` ADD CONSTRAINT `usageRecords_taskExecutionId_taskExecutions_id_fk` FOREIGN KEY (`taskExecutionId`) REFERENCES `taskExecutions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowExecutions` ADD CONSTRAINT `workflowExecutions_workflowId_workflows_id_fk` FOREIGN KEY (`workflowId`) REFERENCES `workflows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowExecutions` ADD CONSTRAINT `workflowExecutions_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowNodes` ADD CONSTRAINT `workflowNodes_workflowVersionId_workflowVersions_id_fk` FOREIGN KEY (`workflowVersionId`) REFERENCES `workflowVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowVersions` ADD CONSTRAINT `workflowVersions_workflowId_workflows_id_fk` FOREIGN KEY (`workflowId`) REFERENCES `workflows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowVersions` ADD CONSTRAINT `workflowVersions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflows` ADD CONSTRAINT `workflows_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflows` ADD CONSTRAINT `workflows_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflows` ADD CONSTRAINT `workflows_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agents_org_status_idx` ON `agentDefinitions` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `approvals_org_status_idx` ON `approvals` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `auditLogs_org_created_idx` ON `auditLogs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `eventRecords_org_occurred_idx` ON `eventRecords` (`organizationId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `jobs_status_runAfter_idx` ON `jobs` (`status`,`runAfter`);--> statement-breakpoint
CREATE INDEX `memoryEntries_memory_idx` ON `memoryEntries` (`memoryId`);--> statement-breakpoint
CREATE INDEX `projects_org_idx` ON `projects` (`organizationId`);--> statement-breakpoint
CREATE INDEX `taskExecutions_task_idx` ON `taskExecutions` (`taskId`);--> statement-breakpoint
CREATE INDEX `tasks_org_status_idx` ON `tasks` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parentTaskId`);--> statement-breakpoint
CREATE INDEX `usageRecords_org_created_idx` ON `usageRecords` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `workflowExecutions_workflow_idx` ON `workflowExecutions` (`workflowId`);--> statement-breakpoint
CREATE INDEX `workflows_org_status_idx` ON `workflows` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `workflows_schedule_idx` ON `workflows` (`scheduleCronTaskUid`);